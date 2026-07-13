const config = require('../config');

// Posts a MessageCard to a Microsoft Teams incoming webhook.
async function notifyTeams(title, text, facts = []) {
  if (!config.teamsWebhookUrl) return;
  try {
    await fetch(config.teamsWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '1e3a5f',
        summary: title,
        sections: [{ activityTitle: `**${title}**`, text, facts: facts.map(([name, value]) => ({ name, value: String(value) })) }],
      }),
    });
  } catch (err) {
    console.error('Teams notification failed:', err.message);
  }
}

module.exports = { notifyTeams };
