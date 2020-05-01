/*
 * Builder for HTML tag hierarchies.
 */
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


