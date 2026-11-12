-- Fix seed profiles that got profile_completed=false from the auto-create trigger.
-- Run in Supabase SQL Editor.

UPDATE profiles SET
  profile_completed = true,
  name              = first_name,
  gender = CASE
    WHEN first_name IN ('Emma','Maja','Astrid','Elsa','Linnea','Saga','Alva','Ebba',
                        'Ida','Clara','Sofia','Lena','Anna','Maria','Sara','Frida',
                        'Julia','Nora','Petra','Amanda','Lisa','Helena','Elin','Cecilia','Agnes')
    THEN 'female' ELSE 'male' END,
  looking_for = CASE
    WHEN first_name IN ('Emma','Maja','Astrid','Elsa','Linnea','Saga','Alva','Ebba',
                        'Ida','Clara','Sofia','Lena','Anna','Maria','Sara','Frida',
                        'Julia','Nora','Petra','Amanda','Lisa','Helena','Elin','Cecilia','Agnes')
    THEN 'male' ELSE 'female' END,
  dating_goal  = COALESCE(dating_goal, 'relationship'),
  min_age      = 18,
  max_age      = 45,
  coin_balance = 500,
  distance     = 25,
  age = CASE first_name
    WHEN 'Emma'      THEN 24 WHEN 'Maja'      THEN 22 WHEN 'Astrid'    THEN 26
    WHEN 'Elsa'      THEN 21 WHEN 'Linnea'    THEN 28 WHEN 'Saga'      THEN 23
    WHEN 'Alva'      THEN 25 WHEN 'Ebba'      THEN 27 WHEN 'Ida'       THEN 30
    WHEN 'Clara'     THEN 23 WHEN 'Sofia'     THEN 31 WHEN 'Lena'      THEN 33
    WHEN 'Anna'      THEN 26 WHEN 'Maria'     THEN 24 WHEN 'Sara'      THEN 29
    WHEN 'Frida'     THEN 23 WHEN 'Julia'     THEN 25 WHEN 'Nora'      THEN 27
    WHEN 'Petra'     THEN 30 WHEN 'Amanda'    THEN 22 WHEN 'Lisa'      THEN 24
    WHEN 'Helena'    THEN 32 WHEN 'Elin'      THEN 26 WHEN 'Cecilia'   THEN 29
    WHEN 'Agnes'     THEN 21 WHEN 'Erik'      THEN 28 WHEN 'Bjorn'     THEN 30
    WHEN 'Lucas'     THEN 25 WHEN 'Axel'      THEN 27 WHEN 'Oliver'    THEN 23
    WHEN 'Sebastian' THEN 29 WHEN 'Viktor'    THEN 31 WHEN 'Anton'     THEN 26
    WHEN 'Filip'     THEN 24 WHEN 'Gustav'    THEN 28 WHEN 'Johan'     THEN 32
    WHEN 'David'     THEN 27 WHEN 'Marcus'    THEN 25 WHEN 'Andreas'   THEN 29
    WHEN 'Karl'      THEN 33 WHEN 'Henrik'    THEN 26 WHEN 'Simon'     THEN 28
    WHEN 'Tobias'    THEN 24 WHEN 'Oscar'     THEN 30 WHEN 'William'   THEN 27
    WHEN 'Max'       THEN 23 WHEN 'Adam'      THEN 25 WHEN 'Emil'      THEN 29
    WHEN 'Daniel'    THEN 31 WHEN 'Alexander' THEN 26
    ELSE 25
  END,
  avatar = CASE first_name
    WHEN 'Emma'      THEN 'https://randomuser.me/api/portraits/women/1.jpg'
    WHEN 'Maja'      THEN 'https://randomuser.me/api/portraits/women/2.jpg'
    WHEN 'Astrid'    THEN 'https://randomuser.me/api/portraits/women/3.jpg'
    WHEN 'Elsa'      THEN 'https://randomuser.me/api/portraits/women/4.jpg'
    WHEN 'Linnea'    THEN 'https://randomuser.me/api/portraits/women/5.jpg'
    WHEN 'Saga'      THEN 'https://randomuser.me/api/portraits/women/6.jpg'
    WHEN 'Alva'      THEN 'https://randomuser.me/api/portraits/women/7.jpg'
    WHEN 'Ebba'      THEN 'https://randomuser.me/api/portraits/women/8.jpg'
    WHEN 'Ida'       THEN 'https://randomuser.me/api/portraits/women/9.jpg'
    WHEN 'Clara'     THEN 'https://randomuser.me/api/portraits/women/10.jpg'
    WHEN 'Sofia'     THEN 'https://randomuser.me/api/portraits/women/11.jpg'
    WHEN 'Lena'      THEN 'https://randomuser.me/api/portraits/women/12.jpg'
    WHEN 'Anna'      THEN 'https://randomuser.me/api/portraits/women/13.jpg'
    WHEN 'Maria'     THEN 'https://randomuser.me/api/portraits/women/14.jpg'
    WHEN 'Sara'      THEN 'https://randomuser.me/api/portraits/women/15.jpg'
    WHEN 'Frida'     THEN 'https://randomuser.me/api/portraits/women/16.jpg'
    WHEN 'Julia'     THEN 'https://randomuser.me/api/portraits/women/17.jpg'
    WHEN 'Nora'      THEN 'https://randomuser.me/api/portraits/women/18.jpg'
    WHEN 'Petra'     THEN 'https://randomuser.me/api/portraits/women/19.jpg'
    WHEN 'Amanda'    THEN 'https://randomuser.me/api/portraits/women/20.jpg'
    WHEN 'Lisa'      THEN 'https://randomuser.me/api/portraits/women/21.jpg'
    WHEN 'Helena'    THEN 'https://randomuser.me/api/portraits/women/22.jpg'
    WHEN 'Elin'      THEN 'https://randomuser.me/api/portraits/women/23.jpg'
    WHEN 'Cecilia'   THEN 'https://randomuser.me/api/portraits/women/24.jpg'
    WHEN 'Agnes'     THEN 'https://randomuser.me/api/portraits/women/25.jpg'
    WHEN 'Erik'      THEN 'https://randomuser.me/api/portraits/men/1.jpg'
    WHEN 'Bjorn'     THEN 'https://randomuser.me/api/portraits/men/2.jpg'
    WHEN 'Lucas'     THEN 'https://randomuser.me/api/portraits/men/3.jpg'
    WHEN 'Axel'      THEN 'https://randomuser.me/api/portraits/men/4.jpg'
    WHEN 'Oliver'    THEN 'https://randomuser.me/api/portraits/men/5.jpg'
    WHEN 'Sebastian' THEN 'https://randomuser.me/api/portraits/men/6.jpg'
    WHEN 'Viktor'    THEN 'https://randomuser.me/api/portraits/men/7.jpg'
    WHEN 'Anton'     THEN 'https://randomuser.me/api/portraits/men/8.jpg'
    WHEN 'Filip'     THEN 'https://randomuser.me/api/portraits/men/9.jpg'
    WHEN 'Gustav'    THEN 'https://randomuser.me/api/portraits/men/10.jpg'
    WHEN 'Johan'     THEN 'https://randomuser.me/api/portraits/men/11.jpg'
    WHEN 'David'     THEN 'https://randomuser.me/api/portraits/men/12.jpg'
    WHEN 'Marcus'    THEN 'https://randomuser.me/api/portraits/men/13.jpg'
    WHEN 'Andreas'   THEN 'https://randomuser.me/api/portraits/men/14.jpg'
    WHEN 'Karl'      THEN 'https://randomuser.me/api/portraits/men/15.jpg'
    WHEN 'Henrik'    THEN 'https://randomuser.me/api/portraits/men/16.jpg'
    WHEN 'Simon'     THEN 'https://randomuser.me/api/portraits/men/17.jpg'
    WHEN 'Tobias'    THEN 'https://randomuser.me/api/portraits/men/18.jpg'
    WHEN 'Oscar'     THEN 'https://randomuser.me/api/portraits/men/19.jpg'
    WHEN 'William'   THEN 'https://randomuser.me/api/portraits/men/20.jpg'
    WHEN 'Max'       THEN 'https://randomuser.me/api/portraits/men/21.jpg'
    WHEN 'Adam'      THEN 'https://randomuser.me/api/portraits/men/22.jpg'
    WHEN 'Emil'      THEN 'https://randomuser.me/api/portraits/men/23.jpg'
    WHEN 'Daniel'    THEN 'https://randomuser.me/api/portraits/men/24.jpg'
    WHEN 'Alexander' THEN 'https://randomuser.me/api/portraits/men/25.jpg'
  END,
  images = CASE first_name
    WHEN 'Emma'      THEN ARRAY['https://randomuser.me/api/portraits/women/1.jpg','https://randomuser.me/api/portraits/women/31.jpg','https://randomuser.me/api/portraits/women/61.jpg']
    WHEN 'Maja'      THEN ARRAY['https://randomuser.me/api/portraits/women/2.jpg','https://randomuser.me/api/portraits/women/32.jpg','https://randomuser.me/api/portraits/women/62.jpg']
    WHEN 'Astrid'    THEN ARRAY['https://randomuser.me/api/portraits/women/3.jpg','https://randomuser.me/api/portraits/women/33.jpg','https://randomuser.me/api/portraits/women/63.jpg']
    WHEN 'Elsa'      THEN ARRAY['https://randomuser.me/api/portraits/women/4.jpg','https://randomuser.me/api/portraits/women/34.jpg','https://randomuser.me/api/portraits/women/64.jpg']
    WHEN 'Linnea'    THEN ARRAY['https://randomuser.me/api/portraits/women/5.jpg','https://randomuser.me/api/portraits/women/35.jpg','https://randomuser.me/api/portraits/women/65.jpg']
    WHEN 'Saga'      THEN ARRAY['https://randomuser.me/api/portraits/women/6.jpg','https://randomuser.me/api/portraits/women/36.jpg','https://randomuser.me/api/portraits/women/66.jpg']
    WHEN 'Alva'      THEN ARRAY['https://randomuser.me/api/portraits/women/7.jpg','https://randomuser.me/api/portraits/women/37.jpg','https://randomuser.me/api/portraits/women/67.jpg']
    WHEN 'Ebba'      THEN ARRAY['https://randomuser.me/api/portraits/women/8.jpg','https://randomuser.me/api/portraits/women/38.jpg','https://randomuser.me/api/portraits/women/68.jpg']
    WHEN 'Ida'       THEN ARRAY['https://randomuser.me/api/portraits/women/9.jpg','https://randomuser.me/api/portraits/women/39.jpg','https://randomuser.me/api/portraits/women/69.jpg']
    WHEN 'Clara'     THEN ARRAY['https://randomuser.me/api/portraits/women/10.jpg','https://randomuser.me/api/portraits/women/40.jpg','https://randomuser.me/api/portraits/women/70.jpg']
    WHEN 'Sofia'     THEN ARRAY['https://randomuser.me/api/portraits/women/11.jpg','https://randomuser.me/api/portraits/women/41.jpg','https://randomuser.me/api/portraits/women/71.jpg']
    WHEN 'Lena'      THEN ARRAY['https://randomuser.me/api/portraits/women/12.jpg','https://randomuser.me/api/portraits/women/42.jpg','https://randomuser.me/api/portraits/women/72.jpg']
    WHEN 'Anna'      THEN ARRAY['https://randomuser.me/api/portraits/women/13.jpg','https://randomuser.me/api/portraits/women/43.jpg','https://randomuser.me/api/portraits/women/73.jpg']
    WHEN 'Maria'     THEN ARRAY['https://randomuser.me/api/portraits/women/14.jpg','https://randomuser.me/api/portraits/women/44.jpg','https://randomuser.me/api/portraits/women/74.jpg']
    WHEN 'Sara'      THEN ARRAY['https://randomuser.me/api/portraits/women/15.jpg','https://randomuser.me/api/portraits/women/45.jpg','https://randomuser.me/api/portraits/women/75.jpg']
    WHEN 'Frida'     THEN ARRAY['https://randomuser.me/api/portraits/women/16.jpg','https://randomuser.me/api/portraits/women/46.jpg','https://randomuser.me/api/portraits/women/76.jpg']
    WHEN 'Julia'     THEN ARRAY['https://randomuser.me/api/portraits/women/17.jpg','https://randomuser.me/api/portraits/women/47.jpg','https://randomuser.me/api/portraits/women/77.jpg']
    WHEN 'Nora'      THEN ARRAY['https://randomuser.me/api/portraits/women/18.jpg','https://randomuser.me/api/portraits/women/48.jpg','https://randomuser.me/api/portraits/women/78.jpg']
    WHEN 'Petra'     THEN ARRAY['https://randomuser.me/api/portraits/women/19.jpg','https://randomuser.me/api/portraits/women/49.jpg','https://randomuser.me/api/portraits/women/79.jpg']
    WHEN 'Amanda'    THEN ARRAY['https://randomuser.me/api/portraits/women/20.jpg','https://randomuser.me/api/portraits/women/50.jpg','https://randomuser.me/api/portraits/women/80.jpg']
    WHEN 'Lisa'      THEN ARRAY['https://randomuser.me/api/portraits/women/21.jpg','https://randomuser.me/api/portraits/women/51.jpg','https://randomuser.me/api/portraits/women/81.jpg']
    WHEN 'Helena'    THEN ARRAY['https://randomuser.me/api/portraits/women/22.jpg','https://randomuser.me/api/portraits/women/52.jpg','https://randomuser.me/api/portraits/women/82.jpg']
    WHEN 'Elin'      THEN ARRAY['https://randomuser.me/api/portraits/women/23.jpg','https://randomuser.me/api/portraits/women/53.jpg','https://randomuser.me/api/portraits/women/83.jpg']
    WHEN 'Cecilia'   THEN ARRAY['https://randomuser.me/api/portraits/women/24.jpg','https://randomuser.me/api/portraits/women/54.jpg','https://randomuser.me/api/portraits/women/84.jpg']
    WHEN 'Agnes'     THEN ARRAY['https://randomuser.me/api/portraits/women/25.jpg','https://randomuser.me/api/portraits/women/55.jpg','https://randomuser.me/api/portraits/women/85.jpg']
    WHEN 'Erik'      THEN ARRAY['https://randomuser.me/api/portraits/men/1.jpg','https://randomuser.me/api/portraits/men/31.jpg','https://randomuser.me/api/portraits/men/61.jpg']
    WHEN 'Bjorn'     THEN ARRAY['https://randomuser.me/api/portraits/men/2.jpg','https://randomuser.me/api/portraits/men/32.jpg','https://randomuser.me/api/portraits/men/62.jpg']
    WHEN 'Lucas'     THEN ARRAY['https://randomuser.me/api/portraits/men/3.jpg','https://randomuser.me/api/portraits/men/33.jpg','https://randomuser.me/api/portraits/men/63.jpg']
    WHEN 'Axel'      THEN ARRAY['https://randomuser.me/api/portraits/men/4.jpg','https://randomuser.me/api/portraits/men/34.jpg','https://randomuser.me/api/portraits/men/64.jpg']
    WHEN 'Oliver'    THEN ARRAY['https://randomuser.me/api/portraits/men/5.jpg','https://randomuser.me/api/portraits/men/35.jpg','https://randomuser.me/api/portraits/men/65.jpg']
    WHEN 'Sebastian' THEN ARRAY['https://randomuser.me/api/portraits/men/6.jpg','https://randomuser.me/api/portraits/men/36.jpg','https://randomuser.me/api/portraits/men/66.jpg']
    WHEN 'Viktor'    THEN ARRAY['https://randomuser.me/api/portraits/men/7.jpg','https://randomuser.me/api/portraits/men/37.jpg','https://randomuser.me/api/portraits/men/67.jpg']
    WHEN 'Anton'     THEN ARRAY['https://randomuser.me/api/portraits/men/8.jpg','https://randomuser.me/api/portraits/men/38.jpg','https://randomuser.me/api/portraits/men/68.jpg']
    WHEN 'Filip'     THEN ARRAY['https://randomuser.me/api/portraits/men/9.jpg','https://randomuser.me/api/portraits/men/39.jpg','https://randomuser.me/api/portraits/men/69.jpg']
    WHEN 'Gustav'    THEN ARRAY['https://randomuser.me/api/portraits/men/10.jpg','https://randomuser.me/api/portraits/men/40.jpg','https://randomuser.me/api/portraits/men/70.jpg']
    WHEN 'Johan'     THEN ARRAY['https://randomuser.me/api/portraits/men/11.jpg','https://randomuser.me/api/portraits/men/41.jpg','https://randomuser.me/api/portraits/men/71.jpg']
    WHEN 'David'     THEN ARRAY['https://randomuser.me/api/portraits/men/12.jpg','https://randomuser.me/api/portraits/men/42.jpg','https://randomuser.me/api/portraits/men/72.jpg']
    WHEN 'Marcus'    THEN ARRAY['https://randomuser.me/api/portraits/men/13.jpg','https://randomuser.me/api/portraits/men/43.jpg','https://randomuser.me/api/portraits/men/73.jpg']
    WHEN 'Andreas'   THEN ARRAY['https://randomuser.me/api/portraits/men/14.jpg','https://randomuser.me/api/portraits/men/44.jpg','https://randomuser.me/api/portraits/men/74.jpg']
    WHEN 'Karl'      THEN ARRAY['https://randomuser.me/api/portraits/men/15.jpg','https://randomuser.me/api/portraits/men/45.jpg','https://randomuser.me/api/portraits/men/75.jpg']
    WHEN 'Henrik'    THEN ARRAY['https://randomuser.me/api/portraits/men/16.jpg','https://randomuser.me/api/portraits/men/46.jpg','https://randomuser.me/api/portraits/men/76.jpg']
    WHEN 'Simon'     THEN ARRAY['https://randomuser.me/api/portraits/men/17.jpg','https://randomuser.me/api/portraits/men/47.jpg','https://randomuser.me/api/portraits/men/77.jpg']
    WHEN 'Tobias'    THEN ARRAY['https://randomuser.me/api/portraits/men/18.jpg','https://randomuser.me/api/portraits/men/48.jpg','https://randomuser.me/api/portraits/men/78.jpg']
    WHEN 'Oscar'     THEN ARRAY['https://randomuser.me/api/portraits/men/19.jpg','https://randomuser.me/api/portraits/men/49.jpg','https://randomuser.me/api/portraits/men/79.jpg']
    WHEN 'William'   THEN ARRAY['https://randomuser.me/api/portraits/men/20.jpg','https://randomuser.me/api/portraits/men/50.jpg','https://randomuser.me/api/portraits/men/80.jpg']
    WHEN 'Max'       THEN ARRAY['https://randomuser.me/api/portraits/men/21.jpg','https://randomuser.me/api/portraits/men/51.jpg','https://randomuser.me/api/portraits/men/81.jpg']
    WHEN 'Adam'      THEN ARRAY['https://randomuser.me/api/portraits/men/22.jpg','https://randomuser.me/api/portraits/men/52.jpg','https://randomuser.me/api/portraits/men/82.jpg']
    WHEN 'Emil'      THEN ARRAY['https://randomuser.me/api/portraits/men/23.jpg','https://randomuser.me/api/portraits/men/53.jpg','https://randomuser.me/api/portraits/men/83.jpg']
    WHEN 'Daniel'    THEN ARRAY['https://randomuser.me/api/portraits/men/24.jpg','https://randomuser.me/api/portraits/men/54.jpg','https://randomuser.me/api/portraits/men/84.jpg']
    WHEN 'Alexander' THEN ARRAY['https://randomuser.me/api/portraits/men/25.jpg','https://randomuser.me/api/portraits/men/55.jpg','https://randomuser.me/api/portraits/men/85.jpg']
  END
WHERE email LIKE 'seed.%@loveback.test';
