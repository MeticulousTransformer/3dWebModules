/**
 * gears.js — gear teeth that actually mesh.
 *
 * A gear tooth is not a triangle or a rounded bump. Its flanks are involutes
 * of a circle: the curve traced by the end of a string being unwound from a
 * drum. That shape is used because it is the only one where two gears
 * transmit motion at a perfectly constant ratio no matter how far apart you
 * mount them — which is why every gear you have ever seen has it.
 *
 *   const gear = createGearProfile({ teeth: 24, module: 0.08 });
 *   const geometry = new THREE.ExtrudeGeometry(gear.shape, { depth: 0.1 });
 *   // gear.pitchRadius is what you space the centres by.
 *
 * The other half of the problem is phase: two gears only interlock if one has
 * a gap wherever the other has a tooth. meshAngle() works that out exactly,
 * for any pair at any angle to each other.
 */
import * as THREE from 'three';

/** The involute function: the polar angle of the involute at parameter t. */
function involuteAngle(t) {
  return t - Math.atan(t);
}

/**
 * One gear, as a closed THREE.Shape in the XY plane, centred on the origin
 * with a tooth centred on +X.
 *
 * `module` is the standard gear unit: pitch diameter divided by tooth count.
 * Two gears mesh if they share a module. Everything else follows from it.
 */
export function createGearProfile(options = {}) {
  const {
    teeth = 20,
    module: gearModule = 0.08,
    pressureAngle = (20 * Math.PI) / 180,
    boreRadius = 0,
    steps = 8,
  } = options;

  const pitchRadius = (gearModule * teeth) / 2;
  const baseRadius = pitchRadius * Math.cos(pressureAngle);
  const tipRadius = pitchRadius + gearModule;
  const rootRadius = pitchRadius - 1.25 * gearModule;

  // Where the involute crosses the pitch circle, and where it reaches the tip.
  const tAtPitch = Math.tan(pressureAngle);
  const tAtTip = Math.sqrt(Math.max(0, (tipRadius / baseRadius) ** 2 - 1));

  // Half the tooth's angular thickness, measured at the pitch circle.
  const halfTooth = Math.PI / (2 * teeth);

  /** A point on one flank. side = -1 for the trailing flank, +1 for leading. */
  function flankPoint(t, side) {
    const radius = baseRadius * Math.sqrt(1 + t * t);
    const angle = side * (halfTooth + involuteAngle(tAtPitch) - involuteAngle(t));
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, angle, radius];
  }

  // The outline of a single tooth, from root to root.
  const tooth = [];
  const [, , angleAtBase] = flankPoint(0, -1);

  // Up from the root to the base circle, where the involute can start.
  if (rootRadius < baseRadius) {
    tooth.push([Math.cos(angleAtBase) * rootRadius, Math.sin(angleAtBase) * rootRadius]);
  }
  for (let i = 0; i <= steps; i++) {
    const [x, y] = flankPoint((tAtTip * i) / steps, -1);
    tooth.push([x, y]);
  }
  // Across the tip, then back down the other flank.
  for (let i = steps; i >= 0; i--) {
    const [x, y] = flankPoint((tAtTip * i) / steps, 1);
    tooth.push([x, y]);
  }
  if (rootRadius < baseRadius) {
    const [, , angleAtBaseOther] = flankPoint(0, 1);
    tooth.push([Math.cos(angleAtBaseOther) * rootRadius, Math.sin(angleAtBaseOther) * rootRadius]);
  }

  // Repeat it round the gear, joining consecutive teeth along the root circle.
  const shape = new THREE.Shape();
  const pitch = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const offset = i * pitch;
    const cos = Math.cos(offset);
    const sin = Math.sin(offset);

    for (let j = 0; j < tooth.length; j++) {
      const [x, y] = tooth[j];
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      if (i === 0 && j === 0) shape.moveTo(rx, ry);
      else shape.lineTo(rx, ry);
    }

    // The root arc across to the next tooth.
    const [, , startAngle] = flankPoint(0, 1);
    const [, , endAngle] = flankPoint(0, -1);
    const from = offset + startAngle;
    const to = offset + pitch + endAngle;
    for (let k = 1; k <= 4; k++) {
      const angle = from + ((to - from) * k) / 4;
      shape.lineTo(Math.cos(angle) * rootRadius, Math.sin(angle) * rootRadius);
    }
  }
  shape.closePath();

  if (boreRadius > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  return { shape, pitchRadius, baseRadius, tipRadius, rootRadius, teeth, module: gearModule };
}

/**
 * The angle a driven gear must be at so its teeth fall into the driver's gaps.
 *
 * Think in tooth units along the line joining the two centres. The driver
 * presents some fraction of a tooth there; the driven gear has to present that
 * fraction plus a half, because a tooth has to meet a gap. Rearranged for the
 * driven gear's angle, that is all this is.
 *
 * @param driverAngle  the driver's current rotation, radians
 * @param driverTeeth  its tooth count
 * @param drivenTeeth  the driven gear's tooth count
 * @param lineOfCentres direction from the driver to the driven gear, radians
 */
export function meshAngle(driverAngle, driverTeeth, drivenTeeth, lineOfCentres) {
  const driverPhase = ((lineOfCentres - driverAngle) * driverTeeth) / (Math.PI * 2);
  return lineOfCentres + Math.PI - ((driverPhase + 0.5) * Math.PI * 2) / drivenTeeth;
}

/**
 * Spokes for a big gear, as holes to punch out of its web. Small gears are
 * solid; large ones were cast with spokes because a solid one would be heavy
 * and would crack as it cooled.
 */
export function addSpokeHoles(shape, { count = 5, innerRadius, outerRadius, width = 0.35 }) {
  for (let i = 0; i < count; i++) {
    const centre = (i / count) * Math.PI * 2 + Math.PI / count;
    const half = (Math.PI / count) * (1 - width);

    const hole = new THREE.Path();
    const steps = 10;
    for (let k = 0; k <= steps; k++) {
      const angle = centre - half + (2 * half * k) / steps;
      const point = [Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius];
      if (k === 0) hole.moveTo(point[0], point[1]);
      else hole.lineTo(point[0], point[1]);
    }
    for (let k = steps; k >= 0; k--) {
      const angle = centre - half + (2 * half * k) / steps;
      hole.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
    }
    hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}
