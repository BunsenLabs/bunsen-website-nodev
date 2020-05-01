/*
  bl-repo-index -- package index generator for Debian APT repositories
  Copyright (C) 2015-2019 Jens John <dev@2ion.de>

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
  "bunsen-hydrogen": [
    "https://pkg.bunsenlabs.org/debian/dists/bunsen-hydrogen/main/binary-amd64/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/bunsen-hydrogen/main/binary-i386/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/bunsen-hydrogen/main/binary-armhf/Packages"],
  "jessie-backports": [
    "https://pkg.bunsenlabs.org/debian/dists/jessie-backports/main/binary-amd64/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/jessie-backports/main/binary-i386/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/jessie-backports/main/binary-armhf/Packages"],
  "stretch-backports": [
    "https://pkg.bunsenlabs.org/debian/dists/stretch-backports/main/binary-amd64/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/stretch-backports/main/binary-i386/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/stretch-backports/main/binary-armhf/Packages",
  ],
  "helium": [
    "https://pkg.bunsenlabs.org/debian/dists/helium/main/binary-amd64/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/helium/main/binary-i386/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/helium/main/binary-armhf/Packages"
  ],
 "lithium": [
    "https://pkg.bunsenlabs.org/debian/dists/lithium/main/binary-amd64/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/lithium/main/binary-i386/Packages",
    "https://pkg.bunsenlabs.org/debian/dists/lithium/main/binary-armhf/Packages",
  ],
  "lithium-dev": [
    "https://kelaino.bunsenlabs.org/~johnraff/debian/dists/lithium/main/binary-amd64/Packages",
    "https://kelaino.bunsenlabs.org/~johnraff/debian/dists/lithium/main/binary-i386/Packages",
  ],
};

const DIST_TOC_ENTRIES = {};            /* Global ToC DOM nodes */
const DIST_MOD_DATE = {};               /* Modification dates for each distro's Packages file(s) */
const DIST_PKG_CHANGE_PROMISES = [];    /* Promises for the asynchronous retrieveal of the individual
                                         package's Last-Modified HTTP headers via HEAD requests; there
                                         is no distinction by distro. */
const DIST_BASE_URLS = {};
const DIST_ALL_PKGS = {};

const Layout = class {
  static ul (attr, children) {
    return Layout.generic("ul", attr, children);
  }

  static li (text, attr, children) {
    if (text)
        return Layout.generic_text("li", text, attr, children);
    else
        return Layout.generic("li", attr, children);
  }

  static div (attr, children) {
    return Layout.generic("div", attr, children);
  }

  static a (text, attr, children) {
    if (text)
      return Layout.generic_text("a", text, attr, children);
    else
      return Layout.generic("a", attr, children);
  }

  static h2 (text, attr, children) {
    if (text)
      return Layout.generic_text("h2", text, attr, children);
    else
      return Layout.generic("h2", attr, children);
  }

  static h3 (text, attr, children) {
    if (text)
      return Layout.generic_text("h3", text, attr, children);
    else
      return Layout.generic("h3", attr, children);
  }

  static span (text, attr, children) {
    return Layout.generic_text("span", text, attr, children);
  }

  static td (text, attr, children) {
    return Layout.generic_text("td", text, attr || { align: "left" }, children);
  }

  static tr (attr, children) {
    return Layout.generic("tr", attr, children);
  }

  static th (text, attr, children) {
    return Layout.generic_text("td", text, attr || {align:"left"}, children);
  }

  static tbody (attr, children) {
    return Layout.generic("tbody", attr, children);
  }

  static thead (attr, children) {
    return Layout.generic("thead", attr, children);
  }

  static table (attr, children) {
    return Layout.generic("table", attr, children);
  }

  static generic_text (name, text, attributes, children) {
    const e = Layout.generic(name, attributes, children);
    e.textContent = text;
    return e;
  }

  static generic (name, attributes, children) {
    const attr = attributes || null;
    const chld = children || null;

    const e = document.createElement(name);

    if (attr) {
      for (const [k,v] of Object.entries(attr)) {
        e.setAttribute(k, v);
      }
      // Fuck JS.
      if ("onclick" in attr) {
        e.onclick = attr.onclick;
      }
      if ("onmouseover" in attr) {
        e.onmouseover = attr.onmouseover;
      }
    }

    if (chld) {
      children.forEach(c => {
        e.appendChild(c);
      });
    }

    return e;
  }
};

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

  return packages;
};

function fetch_change_date_for_package(url, dom_node) {
  const request = new Request(url, { method: "HEAD" });
  return fetch(request)
          .then(response => {
            if (!response.ok)
              throw Error(response.statusText);
            const datestr = new Date(response.headers.get("Last-Modified")).toLocaleDateString();
            dom_node.textContent = ` (${datestr})`;
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
    if(DIST_ALL_PKGS[pkgname]) {
      a.setAttribute("href", "#" + DIST_ALL_PKGS[pkgname].replace("_", "-") + "-" + pkgname);
      a.setAttribute("class", "local-package");
      a.setAttribute("title", `Jump to local package ${pkgname}`);
    }
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
          node.appendChild(Layout.span(" | "));
      }
    } else 
      process_package_str(pkgstr);

    if(i < (pkgs.length-1))
      node.appendChild(Layout.span(", "));
  }
}

function render_distro_anchor(p, distro) {
  const anchor =  Layout.div({
    id: `#container-for-${distro}`,
    class: "distro-container"
  });
  p.appendChild(anchor);
  return anchor;
}

/* Put distro information into the DOM.
 * @param p DOM node to append the content to
 * @param distro Name of the distro
 * @param m Unified package map
 * @return Nothing
 */
function render_distro(p, distro, m) {
  const h2 = Layout.h2(distro, { id: distro });
  p.appendChild(h2);

  /* Sorted output */
  const pkeys = [];
  for(let k of m.keys())
    pkeys.push(k);
  pkeys.sort();

  /* Package number in global ToC */
  const tocli = DIST_TOC_ENTRIES[distro];
  if (tocli) {
    tocli.appendChild(
      Layout.span(`${pkeys.length} package${pkeys.length==1?"":"s"}, last updated on ${DIST_MOD_DATE[distro].toLocaleDateString()}`,
        { class: "pkg-count" }));
  }

  /* Table of Contents */
  const nav = Layout.div({ class: "toc" }, [
    Layout.ul(null, pkeys.map(k => {
      const pkg = m.get(k);
      return Layout.li(null, {
          onclick: () => { window.location = `#${distro}-${pkg.name}`; },
          onmouseover: (e) => { e.target.style.cursor = "pointer"; },
        }, [
        Layout.a(pkg.name, { href: `#${distro}-${pkg.name}`}),
        Layout.span(pkg.version, { class: "pkg-version" })
      ]);
    }))
  ]);
  p.appendChild(nav);

  pkeys.forEach(k => {
    let pkg = m.get(k);
    let pkgmodnode = null;

    const h3 = Layout.h3(null, { id: `${distro}-${pkg.name}` }, [
      Layout.a(pkg.name, { href: `#${distro}-${pkg.name}`})
    ]);
    p.appendChild(h3); // FIXME: Remove reference further down

    const ul = Layout.ul();
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

    const table = Layout.table(null, [
      Layout.thead(null, [
        Layout.tr({ class: "header" }, [
          Layout.th("Architecture"),
          Layout.th("Size"),
          Layout.th("SHA-1")
        ])
      ])
    ]);

    const tbody = Layout.tbody();

    Object.keys(pkg.arch).sort().forEach(arch => {
      const tr = Layout.tr(null, [
        Layout.td(arch),
        Layout.td(Math.ceil(parseFloat(pkg.arch[arch].size)/1024) + " kB"),
        Layout.td(pkg.arch[arch].sha1)
      ]);

      tr.onclick = () => { window.location = pkg.arch[arch].url; };
      tr.onmouseover = () => { tr.style.cursor = "pointer"; };

      tbody.appendChild(tr);

      DIST_PKG_CHANGE_PROMISES.push(fetch_change_date_for_package(pkg.arch[arch].url, pkgmodnode));
    });

    table.appendChild(tbody);
    p.appendChild(table);

  });
};

/* Adds the list of distros to the DOM */
function render_main_toc() {
  const anchor = document.querySelector(".toc ul li");
  if(anchor === null) return;
  anchor.appendChild(Layout.ul(null,
    Object.keys(BLDIST).sort().map(distro => {
      const li = Layout.li(null, null, [
        Layout.a(distro, { href: `#${distro}` })
      ]);
      DIST_TOC_ENTRIES[distro] = li;
      return li;
    })
  ));
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

  const distro_keys = Object.keys(BLDIST).sort();

  /* Fetch & render */
  Object.keys(BLDIST).sort().forEach(distro => {
    // Must not happen async to make the render order stable
    const distro_anchor = render_distro_anchor(p, distro);
    const url = BLDIST[distro][0];
    DIST_BASE_URLS[distro] = url.slice(0, url.search("/debian/") + "/debian/".length);
    const promises = BLDIST[distro].map(url => {
      return fetch(url)
              .then(response => {
                if(!response.ok)
                  throw Error(response.statusText);
                DIST_MOD_DATE[distro] = new Date(response.headers.get("Last-Modified"));
                return response.text();
              })
              .then(text => {
                return parse_Packages(text, distro);
              });
    });
    Promise.all(promises)
      .then(package_maps => {
        const unified_package_map = unify_package_maps(package_maps);
        render_distro(distro_anchor, distro, unified_package_map);
      });
  });

  render_package_mod_dates();
};

main("#bl-repo-index");
