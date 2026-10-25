// The show always starts after November 15, so "this season" means since the
// most recent November 15 at midnight Eastern. Eastern is always on standard
// time (UTC-5) by then, so that is 05:00 UTC.
function seasonStart(now = new Date()) {
    const year = now.getUTCFullYear();
    let start = Date.UTC(year, 10, 15, 5);
    if (now.getTime() < start) {
        start = Date.UTC(year - 1, 10, 15, 5);
    }
    return new Date(start);
}

function minutesSinceSeasonStart(now = new Date()) {
    return Math.floor((now.getTime() - seasonStart(now).getTime()) / 60000);
}

module.exports = { seasonStart, minutesSinceSeasonStart };
