"use strict";

fetch("/donations.json")
  .then(resp => {
    if(resp.status == 200) {
      resp
        .json()
        .then(payload => {
          new ProgressBar.Line("#shortfall", {
            duration: 1000,
            color: "#e0ffba",
            text: { value: `Up to ${payload.short_pct*100}% of year ${payload.short_year} funded` }
          }).animate(payload.short_pct);
          document.querySelector("span#d-yearly").textContent = payload.want_pa;
          document.querySelector("span#d-reserve").textContent = payload.reserve;
          document.querySelector("span#d-updated").textContent = payload.last_update;
        });
    }
  });
