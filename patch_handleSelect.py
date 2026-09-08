import re

with open('src/components/FeatureInstanceManager.jsx', 'r') as f:
    code = f.read()

target = r"""      const handleSelect = \(\) => \{
        const state = useMapStore\.getState\(\);
        if \(state\.selectedFeatureId === feature\.id && state\.isInfoPanelOpen\) \{
          state\.setSelectedFeatureId\(null\);
          state\.setIsInfoPanelOpen\(false\);
        \} else \{
          setSelectedFeatureId\(feature\.id\);
          setIsInfoPanelOpen\(true\);
          if \(map\) \{
            zoomToProperty\(map, feature\);
          \}
        \}
      \};"""

repl = """      const handleSelect = () => {
        const state = useMapStore.getState();
        if (state.selectedFeatureId === feature.id && state.isInfoPanelOpen) {
          state.setSelectedFeatureId(null);
          state.setIsInfoPanelOpen(false);
        } else {
          // If panel is already open for another polygon, slide it out first
          if (state.isInfoPanelOpen) {
            state.setIsInfoPanelOpen(false);
            setTimeout(() => {
              setSelectedFeatureId(feature.id);
              setIsInfoPanelOpen(true);
              if (map) zoomToProperty(map, feature);
            }, 250); // wait for slide-out animation to almost finish
          } else {
            setSelectedFeatureId(feature.id);
            setIsInfoPanelOpen(true);
            if (map) zoomToProperty(map, feature);
          }
        }
      };"""

code = re.sub(target, repl, code)

with open('src/components/FeatureInstanceManager.jsx', 'w') as f:
    f.write(code)

