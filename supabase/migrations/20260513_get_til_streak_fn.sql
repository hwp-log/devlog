CREATE OR REPLACE FUNCTION get_til_streak()
RETURNS TABLE (current_streak bigint, best_streak bigint)
LANGUAGE sql
AS $$
  WITH daily AS (
    -- DATE_TRUNC: 같은 날 여러 TIL 작성 시 중복 제거
    SELECT DISTINCT DATE_TRUNC('day', created_at)::date AS entry_date
    FROM til_entries
    WHERE user_id = auth.uid()
  ),
  numbered AS (
    -- ROW_NUMBER() WINDOW 함수: 날짜에 오름차순 순번 부여
    -- (날짜 - 순번): 연속된 날짜는 같은 그룹값이 됨
    SELECT
      entry_date,
      (entry_date - (ROW_NUMBER() OVER (ORDER BY entry_date))::integer) AS grp
    FROM daily
  ),
  groups AS (
    SELECT
      grp,
      COUNT(*)::bigint AS streak_len,
      MAX(entry_date) AS last_day
    FROM numbered
    GROUP BY grp
  )
  SELECT
    -- 현재 연속 기록: 마지막 날이 오늘 또는 어제인 그룹
    COALESCE(
      (SELECT streak_len
       FROM groups
       WHERE last_day >= CURRENT_DATE - 1
         AND last_day <= CURRENT_DATE
       ORDER BY last_day DESC
       LIMIT 1),
      0
    ) AS current_streak,
    -- 최고 기록: 전체 그룹 중 최대
    COALESCE(MAX(streak_len), 0) AS best_streak
  FROM groups;
$$;
