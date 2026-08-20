import { z } from 'zod';

const CoordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const FeatureStyleSchema = z.object({
  fillColor: z.string().optional(),
  fillOpacity: z.number().optional(),
  strokeColor: z.string().optional(),
  strokeWeight: z.number().optional(),
  visible: z.boolean().optional()
});

export const FeatureDataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  tp: z.string().optional(),
  op: z.string().optional(),
  fp: z.string().optional(),
  area: z.number().nullable().optional(),
  location: z.string().optional(),
  parentLocation: z.string().optional(),
  landmark: z.string().optional(),
  type: z.string().optional(),
  remarks: z.string().optional(),
  isActive: z.boolean().optional(),
  matchTier: z.enum(['exact-tp-fp', 'contains', 'nearest-border', 'unmatched']).optional(),
  matchDistanceMeters: z.number().nullable().optional(),
  extendedData: z.record(z.any()).optional()
});

export const FeatureSchema = z.object({
  id: z.string(),
  source: z.enum(['drawn', 'excel', 'kml', 'geojson']),
  type: z.enum(['polygon', 'marker']),
  layerId: z.string().optional(),
  
  coordinates: z.array(CoordinateSchema).optional(),
  position: CoordinateSchema.optional(),
  center: CoordinateSchema.optional(),

  style: FeatureStyleSchema.optional(),
  data: FeatureDataSchema.optional(),

  instances: z.object({
    polygon: z.any().optional(),
    marker: z.any().optional()
  }).optional()
}).refine(data => {
  if (data.type === 'polygon' && (!data.coordinates || data.coordinates.length < 3)) {
    return false;
  }
  if (data.type === 'marker' && !data.position) {
    return false;
  }
  return true;
}, {
  message: "Polygons require at least 3 coordinates. Markers require a position."
});

export const validateFeature = (feature) => {
  return FeatureSchema.parse(feature);
};

export const validateFeatures = (features) => {
  return z.array(FeatureSchema).parse(features);
};
