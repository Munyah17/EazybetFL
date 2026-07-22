-- =====================================================================
-- Seed data: promotions and a Spineazy casino game catalogue stub.
-- Sport groups & competitions are seeded live from The Odds API by the
-- sync-sports edge function (see supabase/functions/sync-sports) so
-- they always reflect what the account actually has access to.
-- =====================================================================

insert into public.promotions (title, description, type, value, min_odds, min_selections, wagering_requirement, active, terms)
values
  ('100% Welcome Bonus', 'Get 100% up to $100 on your first deposit.', 'welcome_bonus', 100, null, null, 3,
   true, 'New customers only. Min deposit $5. Bonus must be wagered 3x on multiples with min odds 1.50 before withdrawal. 7 day expiry.'),
  ('WinBoost', 'Boost your multiple bet odds by 3% on 3+ selections.', 'odds_boost', 3, 1.20, 3, 1,
   true, 'Applies automatically to eligible multiples when enabled on the betslip.'),
  ('Weekend Acca Insurance', 'Get your stake back as a free bet if one leg lets you down.', 'cashback', null, 1.10, 5, 1,
   true, 'Applies to weekend multiples of 5+ selections up to $20 stake.')
on conflict do nothing;

insert into public.casino_games (provider, game_key, title, category, rtp, demo_available, active, display_order)
values
  ('spineazy', 'gates-of-olympus', 'Gates of Olympus', 'Slots', 96.50, true, true, 1),
  ('spineazy', 'sweet-bonanza', 'Sweet Bonanza', 'Slots', 96.48, true, true, 2),
  ('spineazy', 'crazy-time', 'Crazy Time', 'Live Casino', 96.08, false, true, 3),
  ('spineazy', 'aviator', 'Aviator', 'Crash', 97.00, true, true, 4),
  ('spineazy', 'zim-jackpot-roulette', 'Zim Jackpot Roulette', 'Table Games', 97.30, true, true, 5),
  ('spineazy', 'plinko', 'Plinko', 'Instant Win', 97.60, true, true, 6)
on conflict do nothing;
