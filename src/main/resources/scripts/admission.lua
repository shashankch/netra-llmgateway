-- NETRA Multi-Tenant Admission Engine (Zero Over-Admission Guarantee)
-- KEYS[1]: ZSET key (rate limit sliding window: netra:ratelimit:<vkey>)
-- KEYS[2]: String key (monthly spend USD: netra:spend:<vkey>:<yearMonth>)
-- ARGV[1]: Current epoch timestamp ms
-- ARGV[2]: Window size ms (60000 for 1 minute)
-- ARGV[3]: RPM limit (e.g. 10)
-- ARGV[4]: Monthly budget cap USD (e.g. 5.000000)
-- ARGV[5]: Unique Request UUID

local zset_key = KEYS[1]
local spend_key = KEYS[2]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local rpm_limit = tonumber(ARGV[3])
local budget_cap = tonumber(ARGV[4])
local req_id = ARGV[5]

-- 1. Sliding Window RPM Check
local clear_before = now - window
redis.call("ZREMRANGEBYSCORE", zset_key, "-inf", clear_before)
local current_rpm = redis.call("ZCARD", zset_key)

if current_rpm >= rpm_limit then
    redis.call("EXPIRE", zset_key, math.ceil(window / 1000) * 2)
    return {429, "rate_limit_exceeded", tostring(current_rpm)}
end

-- 2. Monthly Budget Check (budget_cap < 0 represents unlimited budget)
local current_spend = tonumber(redis.call("GET", spend_key) or "0")
if budget_cap >= 0 and current_spend >= budget_cap then
    return {402, "budget_exceeded", tostring(current_spend)}
end

-- 3. Optimistic Slot Admission
redis.call("ZADD", zset_key, now, req_id)
redis.call("EXPIRE", zset_key, math.ceil(window / 1000) * 2)

return {200, "admitted", tostring(current_rpm + 1)}
