import { useCallback, useEffect, useRef, useState } from "react";

export type CompassStatus =
  | "insecure"      // not a secure context: browsers block orientation events over plain HTTP
  | "needs-gesture" // iOS 13+: must call enable() from a click/tap handler
  | "waiting"       // listener attached, no heading received yet
  | "active"
  | "denied"
  | "unsupported";

export type OrientationEventType = "deviceorientationabsolute" | "deviceorientation";

/**
 * How `heading` was derived:
 * - webkit:   iOS webkitCompassHeading (computed by the OS)
 * - top-edge: phone tilted < 45° from flat — direction the top edge points (360 − alpha)
 * - camera:   phone held up — direction the back camera points (tilt-compensated)
 */
export type HeadingSource = "webkit" | "top-edge" | "camera";

/** One raw orientation reading, kept for telemetry and the paper's device table. */
export interface OrientationSample {
  eventType: OrientationEventType;
  absolute: boolean;
  rawAlpha: number | null;
  rawBeta: number | null;
  rawGamma: number | null;
  webkitCompassHeading: number | null;
  headingSource: HeadingSource;
  /** Clockwise degrees from north, 0–360. Only true north when `absolute` or iOS. */
  heading: number;
  timestampMs: number;
}

type PermissionedDOE = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<"granted" | "denied">;
};

const RAD = Math.PI / 180;

/**
 * Heading from Euler angles (W3C Z-X'-Y' convention, earth frame x=east, y=north).
 * 360 − alpha is only valid while the phone is roughly flat: near upright (beta ≈ 90°)
 * alpha and gamma both describe yaw (gimbal lock) and alpha alone jumps around. When the
 * phone is held up, use the horizontal direction of the back camera instead.
 */
export function headingFromEuler(alpha: number, beta: number, gamma: number): { heading: number; source: HeadingSource } {
  const cA = Math.cos(alpha * RAD), sA = Math.sin(alpha * RAD);
  const cB = Math.cos(beta * RAD), sB = Math.sin(beta * RAD);
  const cG = Math.cos(gamma * RAD), sG = Math.sin(gamma * RAD);
  // Device -z (out of the back camera) in earth coordinates; its vertical part is -cB·cG.
  if (Math.abs(cB * cG) > Math.SQRT1_2) {
    return { heading: (360 - alpha) % 360, source: "top-edge" };
  }
  const east = -cA * sG - sA * sB * cG;
  const north = -sA * sG + cA * sB * cG;
  return { heading: ((Math.atan2(east, north) / RAD) % 360 + 360) % 360, source: "camera" };
}

const needsPermission = () =>
  typeof (window.DeviceOrientationEvent as PermissionedDOE | undefined)?.requestPermission === "function";

/**
 * Compass heading from browser orientation events.
 *
 * - iOS 13+ requires DeviceOrientationEvent.requestPermission() from a user gesture,
 *   then reports true-north heading via webkitCompassHeading.
 * - Chrome/Android's 'deviceorientation' alpha is relative to an arbitrary start
 *   reference; 'deviceorientationabsolute' is relative to north, so prefer it.
 */
export function useCompass() {
  const sampleRef = useRef<OrientationSample | null>(null);
  const listenerRef = useRef<{ type: OrientationEventType; fn: (e: DeviceOrientationEvent) => void } | null>(null);
  const [status, setStatus] = useState<CompassStatus>(() => {
    if (!window.isSecureContext) return "insecure";
    if (!("DeviceOrientationEvent" in window)) return "unsupported";
    return needsPermission() ? "needs-gesture" : "waiting";
  });

  const attach = useCallback(() => {
    if (listenerRef.current) return;
    const type: OrientationEventType =
      "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";

    const fn = (e: DeviceOrientationEvent) => {
      const webkit = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      let heading: number | null = null;
      let source: HeadingSource = "top-edge";
      if (typeof webkit === "number" && !Number.isNaN(webkit)) {
        heading = webkit;
        source = "webkit";
      } else if (e.alpha != null) {
        ({ heading, source } = headingFromEuler(e.alpha, e.beta ?? 0, e.gamma ?? 0));
      }
      // No reading: keep the last good sample rather than fabricating 0°.
      if (heading == null) return;

      const first = sampleRef.current == null;
      sampleRef.current = {
        eventType: type,
        absolute: e.absolute || type === "deviceorientationabsolute" || typeof webkit === "number",
        rawAlpha: e.alpha,
        rawBeta: e.beta,
        rawGamma: e.gamma,
        webkitCompassHeading: typeof webkit === "number" ? webkit : null,
        headingSource: source,
        heading,
        timestampMs: Date.now(),
      };
      if (first) setStatus("active");
    };

    window.addEventListener(type, fn as EventListener);
    listenerRef.current = { type, fn };
    setStatus("waiting");
  }, []);

  /** Call from a click/tap handler — iOS rejects the permission request otherwise. */
  const enable = useCallback(async (): Promise<boolean> => {
    if (!window.isSecureContext || !("DeviceOrientationEvent" in window)) return false;
    if (listenerRef.current) return true;
    const DOE = window.DeviceOrientationEvent as PermissionedDOE;
    if (typeof DOE.requestPermission === "function") {
      try {
        // W3C spec: requestPermission(absolute = false) omits the magnetometer, which would
        // leave deviceorientationabsolute silent. Safari currently ignores the argument.
        if ((await DOE.requestPermission(true)) !== "granted") {
          setStatus("denied");
          return false;
        }
      } catch {
        setStatus("denied");
        return false;
      }
    }
    attach();
    return true;
  }, [attach]);

  useEffect(() => {
    // Android and desktop need no permission prompt, so attach straight away.
    if (window.isSecureContext && "DeviceOrientationEvent" in window && !needsPermission()) attach();
    return () => {
      if (listenerRef.current) {
        window.removeEventListener(listenerRef.current.type, listenerRef.current.fn as EventListener);
        listenerRef.current = null;
      }
    };
  }, [attach]);

  return { status, enable, sampleRef };
}
