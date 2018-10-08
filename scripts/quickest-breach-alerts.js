"use strict";

const HIBP = require("../hibp");

// https://stackoverflow.com/a/8528531
function dhm(t){
  const cd = 24 * 60 * 60 * 1000,
      ch = 60 * 60 * 1000,
      pad = (n) => { return n < 10 ? "0" + n : n; };
  let d = Math.floor(t / cd),
      h = Math.floor( (t - d * cd) / ch),
      m = Math.round( (t - d * cd - h * ch) / 60000);
  if( m === 60 ){
    h++;
    m = 0;
  }
  if( h === 24 ){
    d++;
    h = 0;
  }
  return [d, pad(h), pad(m)].join(":");
}


(async () => {
  const breaches = await HIBP.req("/breaches");

  let fastestResponseTime = Math.abs(new Date() - new Date(0));
  let fastestResponseBreach = "";

  for (const breach of breaches.body) {
    console.log("checking response time for breach: ", breach.Name);
    const responseTime = Math.abs(new Date(breach.BreachDate) - new Date(breach.AddedDate));
    if (responseTime < fastestResponseTime) {
      fastestResponseTime = responseTime;
      fastestResponseBreach = breach.Name;
    }
  }

  console.log("fastest breach response time (dd:hh:mm): ", dhm(Math.abs(fastestResponseTime)));
  console.log("on breach: ", fastestResponseBreach);
})();
