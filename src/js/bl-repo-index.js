/*
  bl-repo-index -- package index generator for Debian APT repositories
  Copyright (C) 2015-2018 Jens John <dev@2ion.de>

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

const BLDIST = {
  bunsen_hydrogen: [
    "https://eu.pkg.bunsenlabs.org/debian/dists/bunsen-hydrogen/main/binary-amd64/Packages",
    "https://eu.pkg.bunsenlabs.org/debian/dists/bunsen-hydrogen/main/binary-i386/Packages",
    "https://eu.pkg.bunsenlabs.org/debian/dists/bunsen-hydrogen/main/binary-armhf/Packages"],
  jessie_backports: [
    "https://eu.pkg.bunsenlabs.org/debian/dists/jessie-backports/main/binary-amd64/Packages",
    "https://eu.pkg.bunsenlabs.org/debian/dists/jessie-backports/main/binary-i386/Packages",
    "https://eu.pkg.bunsenlabs.org/debian/dists/jessie-backports/main/binary-armhf/Packages"],
  stretch_backports: [
    "https://eu.pkg.bunsenlabs.org/debian/dists/stretch-backports/main/binary-amd64/Packages",
    "https://eu.pkg.bunsenlabs.org/debian/dists/stretch-backports/main/binary-i386/Packages"
  ],
  helium: [
    "https://eu.pkg.bunsenlabs.org/debian/dists/helium/main/binary-amd64/Packages",
    "https://eu.pkg.bunsenlabs.org/debian/dists/helium/main/binary-i386/Packages",
    "https://eu.pkg.bunsenlabs.org/debian/dists/helium/main/binary-armhf/Packages"],
  ]
};

var DIST_TOC_ENTRIES = {};            /* Global ToC DOM nodes */
var DIST_MOD_DATE = {};               /* Modification dates for each distro's Packages file(s) */
var DIST_PKG_CHANGE_PROMISES = [];    /* Promises for the asynchronous retrieveal of the individual
                                         package's Last-Modified HTTP headers via HEAD requests; there
                                         is no distinction by distro. */
var DIST_BASE_URLS = {};
var DIST_ALL_PKGS = {};

/* Uppercase the first letter of a string. */
String.prototype.cfl = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
}

function search_params() {
  let url = new URL(window.location);
  let sp = url.searchParams;
  if(!sp.has("k") || !sp.has("v")) return false;
  return sp;
}

function fill_in_form() {
  let sp = search_params();
  
  if(!sp) return;

  let select = document.querySelector("#filter-key");
  let input = document.querySelector("#filter-value");

  select.value = sp.get("k");
  input.value = sp.get("v");
}

function apply_filter(pkgmap) {
  let sp = search_params();
  if(!sp) return pkgmap;

  let test = new RegExp(sp.get("v"), "i");
  let regex = null;

  switch(sp.get("k")) {
    case "any":
      regex = /^.*$/;
      break;
    default:
      regex = new RegExp(`^${sp.get("k").replace("-", "|")}$`, "i");
      break;
  }

  for(let [k, v] of pkgmap) {
    let keep = false;
    for(let field in v) {
      if(regex.exec(field) && test.exec(v[field])) {
        keep = true;
        break;
      }
    }
    if(!keep) pkgmap.delete(k);
  }

  return pkgmap;
}


/* Extracts package information from a Debian distro's Packages file.
 * @param Packages String, representation of the file contents
 * @param distro String, name of the distro. This parameter is not used
 * but returned in order to propagate its value to Promise.all()
 * @return Array [Map of packages, String distro name]
 */
function parse_Packages(Packages, distro) {
  const rx = { /* except for Package, which is used as a new-object marker */
    arch:         /^Architecture: (.*)$/,
    version:      /^Version: (.*)$/,
    homepage:     /^Homepage: (.*)$/,
    filename:     /^Filename: (.*)$/,
    maintainer:   /^Maintainer: ([^<]+)/,
    sha256:       /^SHA256: (.*)$/,
    sha1:         /^SHA1: (.*)$/,
    size:         /^Size: (.*)$/,
    description:  /^Description: (.*)$/,
    depends:      /^Depends: (.*)$/,
    recommends:   /^Recommends: (.*)$/,
    suggests:     /^Suggests: (.*)$/,
    section:      /^Section: (.*)$/
  };
  const lines = Packages.split('\n');
  let packages = new Map();
  let pkgi = null;

  let finalize_package = function() {
    pkgi.url = DIST_BASE_URLS[distro] + pkgi.filename;
    pkgi.source = DIST_BASE_URLS[distro] + pkgi.filename.replace(/\/[^/]+$/, "");
    packages.set(pkgi.name, pkgi);
    DIST_ALL_PKGS[pkgi.name] = distro;
  };

  for(let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let cap;

    if(line.match(/^$/))
      continue;

    if(cap = /^Package: (.*)$/.exec(line)) {
      if(pkgi != null) /* Finalize and commit package object */
        finalize_package();
      pkgi = {name: cap[1]};
    }

    for(let expr_name in rx)
      if(cap = rx[expr_name].exec(line)) pkgi[expr_name] = cap[1];
  }
  finalize_package();

  packages = apply_filter(packages);

  return [packages, distro];
};

/* Fetches a Packages file from the internet
 * @param url URL of the Packages file
 * @param distro Name of the distro, passed through to resolve()
 * @return Promise
 */
function fetch(url, distro) {
  return new Promise(
      function(resolve, reject) {
        let r = new XMLHttpRequest();
        r.open('GET', url);
        r.responseType = 'text';
        r.onload = function() {
          switch(r.status) {
            case 200:
              /* FIXME: So ugly. */
              DIST_MOD_DATE[distro] = new Date(r.getResponseHeader("Last-Modified"));
              resolve(parse_Packages(r.response, distro));
              return;
            default:
              reject(Error("Failed to fetch package file: " + url));
          }
        };
        r.onerror = function() {
          reject(Error("Request failed: " + url));
        };
        r.send();
      }
    );
};

function fetch_change_date_for_package(url, dom_node) {
  return new Promise(
      function (resolve, reject) {
        let rf = function (date, node) {
          return [date, node];
        };
        let r = new XMLHttpRequest();
        r.open('HEAD', url);
        r.onload = function () {
          switch(r.status) {
            case 200:
              dom_node.textContent = " (" + new Date(r.getResponseHeader("Last-Modified")).toLocaleDateString() + ")";
              resolve(dom_node.textContent);
              return;
            default:
              reject(Error("Failed to fetch HEAD of file: " + url));
          }
        };
        r.onerror = function () {
          reject(Error("Request failed: " + url));
        };
        r.send();
      });
};

/* Summarizes packages available in more than one architecture under a
 * common package name.
 * @param l Array of Map()s containing package information
 * @return A unified package Map()
 */
function unify_package_maps(l) {
  let m = new Map();
  let extract_arch = function (o) {
    return { url: o.url, sha1: o.sha1, sha256: o.sha256, size: o.size };
  };
  l.forEach(function(pmap){
    for(let [k, v] of pmap) {
      if(!m.has(k))
        m.set(k, {
          name: v.name,
          version: v.version,
          maintainer: v.maintainer,
          homepage: v.homepage,
          description: v.description,
          depends: v.depends,
          source: v.source,
          recommends: v.recommends,
          suggests: v.suggests,
          section: v.section,
          arch: { [v.arch]: extract_arch(v) }
        });
      else if(!m.get(k).arch[v.arch])
        m.get(k).arch[v.arch] = extract_arch(v);
    }
  });
  return m;
}

function link_debian_packages(str, node) {
  let qurl = "https://packages.debian.org/search?suite=all&searchon=names&exact=1&keywords=";
  let pkgs = str.split(',');

  let process_package_str = function (pkgstr) {
    let fields = pkgstr.split(" ");
    let pkgname = fields[0];
    let a = document.createElement("a");
    if(DIST_ALL_PKGS[pkgname])
      a.setAttribute("href", "#" + DIST_ALL_PKGS[pkgname].replace("_", "-") + "-" + pkgname);
    else
      a.setAttribute("href", qurl + pkgname);
    a.textContent = pkgstr;
    node.appendChild(a);
  };

  let create_sep_span = function (c) {
    let span = document.createElement("span");
    span.textContent = c;
    return span;
  };

  for(let i = 0; i < pkgs.length; i++) {
    let pkgstr = pkgs[i].trim();

    if(pkgstr.search(/\|/) != -1) {
      let subpkgs = pkgstr.split("|");
      for(let j = 0; j < subpkgs.length; j++) {
        process_package_str(subpkgs[j].trim());
        if(j < (subpkgs.length-1))
          node.appendChild(create_sep_span(" | "));
      }
    } else 
      process_package_str(pkgstr);

    if(i < (pkgs.length-1))
      node.appendChild(create_sep_span(", "));
  }
}

/* Put distro information into the DOM.
 * @param p DOM node to append the content to
 * @param distro Name of the distro
 * @param m Unified package map
 * @return Nothing
 */
function render_distro(p, distro, m) {
  let distname = distro.replace("_", "-");
  let h2 = document.createElement("h2");
  h2.textContent = distname;
  h2.setAttribute("id", h2.textContent);
  /*
  let h2span = document.createElement("span");
  h2span.setAttribute("class", "distro-modification-date");
  h2span.textContent = "Last update: " + DIST_MOD_DATE[distro].toLocaleDateString();
  h2.appendChild(h2span);
  */
  p.appendChild(h2);

  /* Sorted output */
  let pkeys = [];
  for(let k of m.keys())
    pkeys.push(k);
  pkeys.sort();

  /* Package number in global ToC */
  let tocli = DIST_TOC_ENTRIES[distro];
  if(tocli!=null) {
    let span = document.createElement("span");
    span.setAttribute("class", "pkg-count");
    span.textContent = `${pkeys.length} package${pkeys.length==1?"":"s"}, last updated on ${DIST_MOD_DATE[distro].toLocaleDateString()}`;
    tocli.appendChild(span);
  }

  /* Table of Contents */
  let nav = document.createElement("div");
  nav.setAttribute("class", "toc");
  let navul = document.createElement("ul");
  pkeys.forEach(function (k) {
    let li = document.createElement("li");
    let a = document.createElement("a");
    let pkg = m.get(k);
    a.setAttribute("href", "#"+h2.textContent+"-"+pkg.name);
    a.textContent = pkg.name;
    let span = document.createElement("span");
    span.setAttribute("class", "pkg-version");
    span.textContent = pkg.version;
    li.appendChild(a);
    li.appendChild(span);
    navul.appendChild(li);
  });
  nav.appendChild(navul);
  p.appendChild(nav);

  pkeys.forEach(function (k) {
    let pkg = m.get(k);
    let pkgmodnode = null;

    let h3 = document.createElement("h3");
    h3.setAttribute("id", h2.textContent +"-"+pkg.name);
    let a = document.createElement("a");
    a.setAttribute("href", "#" + h2.textContent +"-"+pkg.name);
    a.textContent = pkg.name;
    h3.appendChild(a);
    p.appendChild(h3);

    let ul = document.createElement("ul");
    ["version", "description", "depends", "recommends", "suggests", "maintainer", "homepage", "source"].forEach(
        function (f) {
          if(!pkg[f]) return; /* empty field, may happen in $depends */
          let li = document.createElement("li");
          switch(f) {
            case "homepage":
            case "source":
              li.textContent = f.cfl() + ": ";
              let a = document.createElement("a");
              a.setAttribute("href", pkg[f]);
              a.textContent = pkg[f];
              li.appendChild(a);
              break;
            case "depends":
            case "recommends":
            case "suggests":
              li.textContent = f.cfl() + ": ";
              link_debian_packages(pkg[f], li);
              break;
            default:
              li.textContent = f.cfl() + ": " + pkg[f];
          }
          if(f==="version") {
            pkgmodnode = document.createElement("span");
            pkgmodnode.setAttribute("class", "pkg-mod-date");
            pkgmodnode.setAttribute("title", "Last package update");
            li.appendChild(pkgmodnode);

            let span = document.createElement("span");
            span.setAttribute("class", "pkg-section");
            span.setAttribute("title", "Package section");
            span.textContent = pkg.section;
            h3.appendChild(span);
          }
          ul.appendChild(li);
        });
    p.appendChild(ul);

    let table = document.createElement("table");

    let thead = document.createElement("thead");
    let tr = document.createElement("tr");
    tr.setAttribute("class", "header");
    let th = document.createElement("th");
    th.setAttribute("align", "left");
    th.textContent = "Architecture";
    tr.appendChild(th);
    th = document.createElement("th");
    th.setAttribute("align", "left");
    th.textContent = "Size";
    tr.appendChild(th);
    th = document.createElement("th");
    th.setAttribute("align", "left");
    th.textContent = "SHA-1"
    tr.appendChild(th);
    thead.appendChild(tr);
    table.appendChild(thead);

    let tbody = document.createElement("tbody");
    let akeys = []; 
    for(let arch in pkg.arch)
      akeys.push(arch);
    akeys.sort();
    akeys.forEach(function (arch) {
      let tr = document.createElement("tr");

      let td = document.createElement("td");
      td.setAttribute("align", "left");
      let a = document.createElement("a");
      a.setAttribute("href", pkg.arch[arch].url);
      a.textContent = arch;
      td.appendChild(a);
      tr.appendChild(td);

      td = document.createElement("td");
      td.setAttribute("align", "left");
      td.textContent = Math.ceil(parseFloat(pkg.arch[arch].size)/1024) + " kB";
      tr.appendChild(td);

      td = document.createElement("td");
      td.setAttribute("align", "left");
      td.textContent = pkg.arch[arch].sha1;
      tr.appendChild(td);

      tbody.appendChild(tr);

      DIST_PKG_CHANGE_PROMISES.push(fetch_change_date_for_package(pkg.arch[arch].url, pkgmodnode));
    });

    table.appendChild(tbody);
    p.appendChild(table);

  });
};

/* Adds the list of distros to the DOM */
function render_main_toc() {
  let anchor = document.querySelector(".toc ul li");
  if(anchor === null) return;
  let ul = document.createElement("ul");
  for(let distro in BLDIST) {
    let li = document.createElement("li");
    let a = document.createElement("a");
    let d = distro.replace("_", "-");
    a.setAttribute("href", "#" + d);
    a.textContent = d;
    li.appendChild(a);
    ul.appendChild(li);
    DIST_TOC_ENTRIES[distro] = li;
  }
  anchor.appendChild(ul);
}

function render_package_mod_dates() {
  Promise.all(DIST_PKG_CHANGE_PROMISES).then(
      function () {},
      function (e) { console.log(e); });
}

function main(node) {
  /* DOM element we attach to */
  let p = document.querySelector(node);
  if(p===null) return;

  fill_in_form();

  render_main_toc();

  /* Always list distros in alphabetical order */
  let distro_keys = Object.keys(BLDIST);
  distro_keys.sort();

  distro_keys.forEach((distro) => {
    let url = BLDIST[distro][0];
    DIST_BASE_URLS[distro] = url.slice(0, url.search("/debian/") + "/debian/".length);
  });

  /* Fetch & render */
  distro_keys.forEach(function (distro) {
    let promises = BLDIST[distro].map((url) => {
      return fetch(url, distro);
    });

    Promise.all(promises).then(
      function (r) {
        let distro = r[0][1];
        let pmaps = [];
        r.forEach(function (e) {
          pmaps.push(e[0]);
        });
        let um = unify_package_maps(pmaps);
        render_distro(p, distro, um);
    });
  });

  render_package_mod_dates();
};

main("#bl-repo-index");
