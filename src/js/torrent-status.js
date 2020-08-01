/* FF >= 50 supports forEach on NodeList though while FF < 50 does not.
 * This function plays this issue over. Oh jeez. */
function nodelistwrap(elem) {
  if(typeof(elem.forEach) == "undefined") {
    let a = [];
    for(var i of elem)
      a.push(i);
    return a;
  }
  return elem;
}

/* Fetch, update and display our torrent seed stats. */
function update_torrent_status() {
  fetch("https://www.bunsenlabs.org/tracker/status")
  .then(response =>  {
    if (!response.ok)
      throw new Error("Failed to query torrent status.");
    return response.json();
  })
  .then(d => {
    nodelistwrap(document.querySelectorAll("p.torrent-status"))
    .forEach((n) => {
      const id = n.getAttribute("data-id");
      if(id in d.torrents) {
        if(n.classList.contains("torrent-status-unknown")) {
          n.classList.add("torrent-status-active");
          n.classList.remove("torrent-status-unknown");
        }
        n.textContent = `${ d.torrents[id].s } seeders | ${ d.torrents[id].l } leechers`;
      }
    });
  });
}

update_torrent_status();
setInterval(update_torrent_status, 10000);
