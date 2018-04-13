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

function update_torrent_status (){
  fetch("https://www.bunsenlabs.org/tracker/status")
  .then(response =>  {
    if (!response.ok)
      throw Error("Failed to query torrent status.");
    return response.json();
  })
  .then(d => {
    nodelistwrap(document.querySelectorAll(".torrent-status"))
    .forEach((n) => {
      const id = n.getAttribute("id");
      if(id in d.torrents) {
	n.textContent = `⬆${ d.torrents[id].s } ⬇${ d.torrents[id].l }`;
	n.style.display = "block";
      }
    });
  });
}

update_torrent_status();
setInterval(update_torrent_status, 10000);
