-- NETRA Multi-Tenant Admission Engine (Zero Over-Admission Guarantee)
-- KEYS[1]: ZSET key (rate limit sliding window: netra:ratelimit:<vkey>)
-- KEYS[2]: String key (monthly spend USD: netra:spend:<vkey>:<yearMonth>)
-- KEYS[3]: String prefix for TPM sliding window (netra:ratelimit:tpm:<vkey>)
-- ARGV[1]: Current epoch timestamp ms
-- ARGV[2]: Window size ms (60000 for 1 minute)
-- ARGV[3]: RPM limit (e.g. 10)
-- ARGV[4]: Monthly budget cap USD (e.g. 5.000000)
-- ARGV[5]: Unique Request UUID
-- ARGV[6]: TPM limit (tokens per minute, e.g. 100000, -1 for unlimited)
-- ARGV[7]: Estimated prompt tokens (e.g. 0 or positive integer)

local zset_key = KEYS[1]
local spend_key = KEYS[2]
local tpm_prefix = KEYS[3]

local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local rpm_limit = tonumber(ARGV[3])
local budget_cap = tonumber(ARGV[4])
local req_id = ARGV[5]
local tpm_limit = tonumber(ARGV[6] or "-1")
local estimated_tokens = tonumber(ARGV[7] or "0")

-- 1. Sliding Window RPM Check
local clear_before = now - window
redis.call("ZREMRANGEBYSCORE", zset_key, "-inf", clear_before)
local current_rpm = redis.call("ZCARD", zset_key)

local oldest_entry = redis.call("ZRANGE", zset_key, 0, 0, "WITHSCORES")
local reset_seconds = math.ceil(window / 1000)
if #oldest_entry >= 2 then
    local oldest_time = tonumber(oldest_entry[2])
    reset_seconds = math.max(1, math.ceil(((oldest_time + window) - now) / 1000))
end

if current_rpm >= rpm_limit then
    redis.call("EXPIRE", zset_key, math.ceil(window / 1000) * 2)
    return {429, "rate_limit_exceeded", tostring(current_rpm), tostring(reset_seconds)}
end

-- 2. Sliding Window TPM (Tokens-Per-Minute) Check
if tpm_prefix and tpm_limit and tpm_limit > 0 then
    local current_minute = math.floor(now / 60000)
    local last_minute = current_minute - 1
    local weight = 1.0 - ((now % 60000) / 60000)

    local tokens_last = tonumber(redis.call("GET", tpm_prefix .. ":" .. last_minute) or "0")
    local tokens_current = tonumber(redis.call("GET", tpm_prefix .. ":" .. current_minute) or "0")
    local estimated_tpm = math.floor(tokens_last * weight + tokens_current)

    if (estimated_tpm + estimated_tokens) > tpm_limit then
        local ms_into_minute = now % 60000
        local ms_to_next_minute = 60000 - ms_into_minute
        local wait_ms = ms_to_next_minute

        if (tokens_current + estimated_tokens) <= tpm_limit then
            -- Quota frees up within the current minute as tokens_last decays
            if tokens_last > 0 then
                local needed_decay = (estimated_tpm + estimated_tokens) - tpm_limit
                wait_ms = math.ceil((needed_decay / tokens_last) * 60000)
            end
        else
            -- tokens_current alone is too large, so wait must extend into the next minute
            -- In the next minute, tokens_current becomes tokens_last and decays
            if tokens_current > 0 and estimated_tokens <= tpm_limit then
                local excess = (tokens_current + estimated_tokens) - tpm_limit
                local next_min_decay_ms = math.ceil((excess / tokens_current) * 60000)
                wait_ms = ms_to_next_minute + next_min_decay_ms
            else
                wait_ms = ms_to_next_minute + 60000
            end
        end

        local tpm_reset_seconds = math.max(1, math.ceil(wait_ms / 1000))
        return {429, "tpm_limit_exceeded", tostring(estimated_tpm), tostring(tpm_reset_seconds)}
    end
end

-- 3. Monthly Budget Check (budget_cap < 0 represents unlimited budget)
local current_spend = tonumber(redis.call("GET", spend_key) or "0")
if budget_cap >= 0 and current_spend >= budget_cap then
    return {402, "budget_exceeded", tostring(current_spend)}
end

-- 4. Optimistic Slot Admission & Token Reservation
redis.call("ZADD", zset_key, now, req_id)
redis.call("EXPIRE", zset_key, math.ceil(window / 1000) * 2)

if tpm_prefix and estimated_tokens > 0 then
    local current_minute = math.floor(now / 60000)
    redis.call("INCRBY", tpm_prefix .. ":" .. current_minute, estimated_tokens)
    redis.call("EXPIRE", tpm_prefix .. ":" .. current_minute, 180)
end

local remaining = math.max(0, rpm_limit - (current_rpm + 1))
return {200, "admitted", tostring(current_rpm + 1), tostring(reset_seconds), tostring(remaining)}
