import re

with open('src/components/ProjectsPanel.jsx', 'r') as f:
    code = f.read()

# 1. Add setSelectedAreaName import from store
code = code.replace(
    "const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);",
    "const setSelectedFeatureId = useMapStore(state => state.setSelectedFeatureId);\n  const setSelectedAreaName = useMapStore(state => state.setSelectedAreaName);"
)
code = code.replace(
    "const selectedFeatureId = useMapStore(state => state.selectedFeatureId);",
    "const selectedFeatureId = useMapStore(state => state.selectedFeatureId);\n  const selectedAreaName = useMapStore(state => state.selectedAreaName);"
)


# 2. In area click handler, set selectedAreaName
target_area_click = r"""                        if \(isSelected\) \{
                          setFilterPrimary\(null\);
                        \} else \{
                          setFilterPrimary\(row\.area\.name\);
                          if \(map && row\.area\.features\.length > 0\) \{
                            fitAllBounds\(map, row\.area\.features\);
                          \}
                        \}"""

repl_area_click = """                        if (isSelected) {
                          setFilterPrimary(null);
                          setSelectedAreaName(null);
                        } else {
                          setFilterPrimary(row.area.name);
                          setSelectedAreaName(row.area.name);
                          if (map && row.area.features.length > 0) {
                            fitAllBounds(map, row.area.features);
                          }
                        }"""
code = re.sub(target_area_click, repl_area_click, code)

# 3. In landmark click handler, if it's NOT a dedicated pin, open the parent property's info panel instead of just zooming.
target_landmark_click = r"""                        if \(isDedicatedLandmarkPin\) \{
                          setSelectedFeatureId\(row\.feature\.id\);
                          setIsInfoPanelOpen\(true\);
                          if \(map && row\.feature\?\.position\) \{
                            map\.panTo\(row\.feature\.position\);
                            map\.setZoom\(17\);
                          \}
                        \} else \{
                          // For geocoded landmarks from property notes, zoom directly to landmark location without opening property polygon panel
                          setSelectedFeatureId\(null\);
                          setIsInfoPanelOpen\(false\);

                          if \(map\) \{
                            const pos = await resolveLandmarkLocation\(row\.landmark\.title, row\.feature\?\.center \|\| row\.feature\?\.position\);
                            if \(pos\) \{
                              map\.panTo\(pos\);
                              map\.setZoom\(17\);
                            \} else \{
                              zoomToProperty\(map, row\.feature\);
                            \}
                          \}
                        \}"""

repl_landmark_click = """                        if (isDedicatedLandmarkPin) {
                          setSelectedFeatureId(row.feature.id);
                          setIsInfoPanelOpen(true);
                          if (map && row.feature?.position) {
                            map.panTo(row.feature.position);
                            map.setZoom(17);
                          }
                        } else {
                          // Property Landmark -> open parent polygon
                          if (row.feature && row.feature.id) {
                            setSelectedFeatureId(row.feature.id);
                            setIsInfoPanelOpen(true);
                            if (map) {
                              const pos = await resolveLandmarkLocation(row.landmark.title, row.feature?.center || row.feature?.position);
                              if (pos) {
                                map.panTo(pos);
                                map.setZoom(17);
                              } else {
                                zoomToProperty(map, row.feature);
                              }
                            }
                          }
                        }"""
code = re.sub(target_landmark_click, repl_landmark_click, code)


with open('src/components/ProjectsPanel.jsx', 'w') as f:
    f.write(code)

