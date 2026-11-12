-- Fix: replace the new-user trigger so it NEVER blocks signup.
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      name,
      first_name,
      last_name,
      phone,
      coin_balance,
      profile_completed,
      min_age,
      max_age,
      distance
    )
    VALUES (
      new.id,
      COALESCE(new.email, ''),
      COALESCE(new.raw_user_meta_data->>'name', ''),
      COALESCE(new.raw_user_meta_data->>'name', ''),
      '',
      '',
      0,
      false,
      18,
      45,
      50
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Never let a profile insert error block the auth signup
    NULL;
  END;

  RETURN new;
END;
$$;

-- Re-attach the trigger (safe to run even if it already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
