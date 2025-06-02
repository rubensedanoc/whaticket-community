import Markdown from "markdown-to-jsx";
import React, { useEffect, useRef } from "react";
import api from "../../services/api";
import { getContactByNumber } from "../../helpers/getContactByNumber";

const elements = [
  "a",
  "abbr",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "bdi",
  "bdo",
  "big",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "keygen",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "marquee",
  "menu",
  "menuitem",
  "meta",
  "meter",
  "nav",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "script",
  "section",
  "select",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "u",
  "ul",
  "var",
  "video",
  "wbr",

  // SVG
  "circle",
  "clipPath",
  "defs",
  "ellipse",
  "foreignObject",
  "g",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "stop",
  "svg",
  "text",
  "tspan",
];

const allowedElements = ["a", "b", "strong", "em", "u", "code", "del"];

const CustomLink = ({ children, ...props }) => (
  <a {...props} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

const replaceWhatsAppNumbersInNode = async (node, onWppNumberClick) => {

  const childNodes = Array.from(node.childNodes);

  if (childNodes.length > 0) {
    childNodes.forEach(async (node) => {
      if (
        node.nodeType === Node.TEXT_NODE &&
        !node?.parentNode?.className?.includes("wppNumberSpan")
      ) {
        const wppNumberRegex = /(\b[+@]?\d{1,4}(?:\s?\d{2,4}){2,3}\b)/g;
        const parts = node.nodeValue.split(wppNumberRegex);

        if (parts.some((part) => wppNumberRegex.test(part))) {
          const fragment = document.createDocumentFragment();

          for (const part of parts) {
            if (wppNumberRegex.test(part)) {

              let contact = await getContactByNumber(part);

              const wppNumberSpan = document.createElement("span");
              wppNumberSpan.className = "wppNumberSpan";
              wppNumberSpan.textContent = contact ? contact.name + "----" : part.trim();
              wppNumberSpan.onclick = () =>
                onWppNumberClick(part.replaceAll(" ", ""));
              wppNumberSpan.style.color = "rgb(83, 189, 235)";
              wppNumberSpan.style.cursor = "pointer";
              wppNumberSpan.style.fontWeight = "bold";
              fragment.appendChild(wppNumberSpan);
            } else {
              fragment.appendChild(document.createTextNode(part));
            }
          }

          const parent = node.parentNode;

          if (parent) {
            parent.replaceChild(fragment, node);
          }

        }
      }
    });
  } else {
    // Solo procesar nodos de texto
    if (node.nodeType === Node.TEXT_NODE) {
      const wppNumberRegex = /(\b[+@]?\d{1,4}(?:\s?\d{2,4}){2,3}\b)/g;
      const parts = node.nodeValue.split(wppNumberRegex);
      if (parts.some((part) => wppNumberRegex.test(part))) {
        const fragment = document.createDocumentFragment();

        for (const part of parts) {
          if (wppNumberRegex.test(part)) {

            let contact = await getContactByNumber(part);

            const wppNumberSpan = document.createElement("span");
            wppNumberSpan.className = "wppNumberSpan";
            wppNumberSpan.textContent = contact ? contact.name + "----" : part.trim();;
            wppNumberSpan.onclick = () =>
              onWppNumberClick(part.replaceAll(" ", ""));
            wppNumberSpan.style.color = "rgb(83, 189, 235)";
            wppNumberSpan.style.cursor = "pointer";
            wppNumberSpan.style.fontWeight = "bold";
            fragment.appendChild(wppNumberSpan);
          } else {
            fragment.appendChild(document.createTextNode(part));
          }
        }

        const parent = node.parentNode;

        if (parent) {
          parent.replaceChild(fragment, node);
        }
      }
    }
  }
};

const MarkdownWrapper = ({
  children,
  checkForWppNumbers,
  onWppNumberClick,
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && checkForWppNumbers) {
      const nodes = Array.from(containerRef.current.childNodes);
      nodes.forEach((node) => {
        replaceWhatsAppNumbersInNode(node, onWppNumberClick);
      });
    }
  }, [children, checkForWppNumbers, onWppNumberClick]);

  // Expresiones regulares para formato de Markdown
  const boldRegex = /\*(.*?)\*/g;
  const tildaRegex = /~(.*?)~/g;

  if (children && children.includes("BEGIN:VCARD")) children = null;
  if (children && children.includes("data:image/")) children = null;

  if (children && boldRegex.test(children)) {
    children = children.replace(boldRegex, "**$1**");
  }
  if (children && tildaRegex.test(children)) {
    children = children.replace(tildaRegex, "~~$1~~");
  }

  const options = React.useMemo(() => {
    const markdownOptions = {
      disableParsingRawHTML: true,
      forceInline: true,
      overrides: {
        a: { component: CustomLink },
      },
    };

    elements.forEach((element) => {
      if (!allowedElements.includes(element)) {
        markdownOptions.overrides[element] = (el) => el.children || null;
      }
    });

    return markdownOptions;
  }, []);

  if (!children) return null;

  return checkForWppNumbers ? (
    <span ref={containerRef} key={children}>
      <Markdown options={options}>{children}</Markdown>
    </span>
  ) : (
    <Markdown options={options}>{children}</Markdown>
  );
};

export default MarkdownWrapper;
