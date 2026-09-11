// Slidev bringt intro, fact, quote und statement bereits als Builtin-Layouts
// in @slidev/client/layouts mit — die Layouts verschwinden also nicht, wenn
// das Default-Theme kein Root mehr ist. fact, quote und statement sind dort
// byteidentisch mit dem Default-Theme; nur intro unterscheidet sich um den
// `my-auto`-Wrapper, der den Inhalt vertikal zentriert. Dieser Re-Export hält
// die Default-Theme-Variante fest. Die Gestaltung (Größen, Grid) kommt in
// beiden Fällen aus dem Deep-Import von layouts.css in styles/index.ts.
export { default } from "@slidev/theme-default/layouts/intro.vue";
