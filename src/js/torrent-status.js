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
    nodelistwrap(document.querySelectorAll(".torrent-status"))
    .forEach((n) => {
      const id = n.getAttribute("id");
      if(id in d.torrents) {
	n.textContent = `⬆${ d.torrents[id].s } ⬇${ d.torrents[id].l }`;
	if (n.style.display != "block") n.style.display = "block";
      }
    });
  });
}

function offer_webtorrent_download() {
  nodelistwrap(document.querySelectorAll(".webtorrent-download"))
    .forEach(node => {
      const torrent_url = n.getAttribute("x-src");
      n.textContent = "Download as WebTorrent";
      n.addEventListener("onclick", event => {
	const client = new WebTorrent(torrent_url, 
      });
    })
}

update_torrent_status();
setInterval(update_torrent_status, 10000);
offer_webtorrent_download();
