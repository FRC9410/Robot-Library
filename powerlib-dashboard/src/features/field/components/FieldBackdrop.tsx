import { useId } from "react";
import type { FieldLayout } from "../fieldLayouts";
import { FieldDrawingShape } from "./FieldDrawingShape";
import { FieldTagMarker } from "./FieldTagMarker";

type FieldBackdropProps = {
  layout: FieldLayout;
  width: number;
  height: number;
  labels?: boolean;
};

/**
 * Draws a field layout under a field drawn as `width` × `height` SVG units with the blue origin at the
 * bottom left: either the WPILib image with its calibrated corners on the field edges, or the simplified
 * drawing. `labels` names the drawing's elements and marks the official AprilTags.
 */
export function FieldBackdrop({ layout, width, height, labels = false }: FieldBackdropProps) {
  const clipId = `field-clip-${useId().replaceAll(":", "")}`;
  const { image, drawing } = layout;
  const scale = width / layout.length;
  return <g pointerEvents="none">
    <defs><clipPath id={clipId}><rect width={width} height={height} rx="5" /></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
      {image && <image href={image.href} x={-image.left * width / (image.right - image.left)} y={-image.top * height / (image.bottom - image.top)}
        width={image.pixelWidth * width / (image.right - image.left)} height={image.pixelHeight * height / (image.bottom - image.top)}
        preserveAspectRatio="none" transform={image.rotate180 ? `rotate(180 ${width / 2} ${height / 2})` : undefined} />}
      {drawing?.map((shape, index) => <FieldDrawingShape key={index} shape={shape} scale={scale} height={height} labels={labels} />)}
      {labels && layout.tags.map(tag => <FieldTagMarker key={tag.id} tag={tag} scale={scale} height={height} />)}
    </g>
  </g>;
}
