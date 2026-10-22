import React from 'react';
import { Html } from '@react-three/drei';

/**
 * SafeHtml: R3F-compliant HTML overlay using @react-three/drei Html.
 * Ensures proper R3F reconciler separation and avoids 'Span is not part of the THREE namespace' crashes.
 */
export default function SafeHtml(props) {
  return <Html {...props} />;
}
