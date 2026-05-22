UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE id = 'dbbb5774-84f3-462b-9f7f-48c22b21a94c';