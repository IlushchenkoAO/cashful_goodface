/* Referrals — placeholder business values. The client edits this file only; all reward copy in the UI
   (how it works, rules, tooltips) is generated from these values. Amounts are in USD.
   rewardType            'percent': the referrer earns a share of the friend's earnings, paid by Cashful
   qualificationEarnings what the friend must earn to become Qualified (dollars)
   oneTimeBonus          optional bonus for the referrer when a friend qualifies (dollars, 0 = off)
   milestones            one-time bonuses by number of Qualified friends (dollars) */
window.Cashful = window.Cashful || {};
Cashful.referralConfig = {
  enabled: true,
  rewardType: 'percent',
  rewardPercent: 10,
  rewardDurationMonths: 12,
  qualificationEarnings: 5,
  attributionWindowDays: 30,
  oneTimeBonus: 0,
  milestones: [
    { qualified: 5,   bonus: 10 },
    { qualified: 25,  bonus: 50 },
    { qualified: 100, bonus: 250 }
  ],
  milestonesEnabled: true,
  shareMessage: 'I’m earning from my idle internet with Cashful. Join with my link and start earning too: {link}',
  shareEmailSubject: 'Earn from your idle internet with Cashful'
};
