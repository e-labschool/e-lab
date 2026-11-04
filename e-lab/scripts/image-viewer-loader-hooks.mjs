// Extra Node loader hook for scripts/test-image-viewer.mjs, registered IN
// ADDITION to jsx-loader-hooks.mjs: the student render tree (LearnBlockRenderer,
// QuestionRenderer) imports side-effect .css files and raster/SVG assets that
// plain Node cannot load. They are stubbed as empty modules / URL strings;
// nothing under test depends on their content.
export async function load(url, context, nextLoad) {
  if (/\.css(\?.*)?$/.test(url)) return { format: "module", source: "export default {};", shortCircuit: true };
  if (/\.(png|jpe?g|gif|webp|svg|avif|woff2?)(\?.*)?$/.test(url)) return { format: "module", source: `export default ${JSON.stringify(url)};`, shortCircuit: true };
  return nextLoad(url, context);
}
