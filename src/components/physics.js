const vec3 = require("gl-vec3");

let newPosition = vec3.create();

export default function (noa) {
  return {
    name: "physics",
    state: { body: null, interpolatePosition: false },
    onAdd: function (entID, state) {
      state.body = noa.physics.addBody();
      // implicitly assume body has a position component, to get size
      var posDat = noa.ents.getPositionData(state.__id);
      setPhysicsFromPosition(state, posDat);
    },
    order: 40,
    onRemove: function (entID, state) {
      if (noa.ents.hasPosition(state.__id)) {
        var pdat = noa.ents.getPositionData(state.__id);
        setPositionFromPhysics(state, pdat);
        backtrackRenderPos(state, pdat, 0, false);
      }
      noa.physics.removeBody(state.body);
    },
    system: function () {},
    renderSystem: function (dt, states) {
      var tickPos = noa.positionInCurrentTick;
      var tickMS = tickPos * noa._tickRate;

      // tickMS is time since last physics engine tick
      // to avoid temporal aliasing, render the state as if lerping between
      // the last position and the next one
      // since the entity data is the "next" position this amounts to
      // offsetting each entity into the past by tickRate - dt
      // http://gafferongames.com/game-physics/fix-your-timestep/

      var backtrackAmt = (tickMS - noa._tickRate) / 100;

      for (let state of states) {
        const positionData = noa.ents.getPositionData(state.__id);
        const id = state.__id;

        vec3.scaleAndAdd(
          newPosition,
          positionData.position,
          state.body.velocity,
          backtrackAmt
        ),
          state.interpolatePosition &&
            !state.body.autoStep &&
            vec3.lerp(
              newPosition,
              positionData._renderPosition,
              newPosition,
              0.5
            ),
          noa.ents.cameraSmoothed(id) &&
            state.body.autoStep &&
            vec3.lerp(
              newPosition,
              positionData._renderPosition,
              newPosition,
              0.33
            ),
          vec3.copy(positionData._renderPosition, newPosition);
      }
    },
  };
}
var local = vec3.create();

export function setPhysicsFromPosition(physState, posState) {
  var box = physState.body.aabb;
  var ext = posState._extents;
  vec3.copy(box.base, ext);
  vec3.set(box.vec, posState.width, posState.height, posState.width);
  vec3.add(box.max, box.base, box.vec);
}

function setPositionFromPhysics(physState, posState) {
  var base = physState.body.aabb.base;
  var hw = posState.width / 2;
  vec3.set(posState._localPosition, base[0] + hw, base[1], base[2] + hw);
}

function backtrackRenderPos(physState, posState, backtrackAmt, smoothed) {
  // pos = pos + backtrack * body.velocity
  var vel = physState.body.velocity;
  vec3.scaleAndAdd(local, posState._localPosition, vel, backtrackAmt);

  // smooth out update if component is present
  // (this is set after sudden movements like auto-stepping)
  if (smoothed) vec3.lerp(local, posState.__renderPosition, local, 0.3);

  // copy values over to _renderPosition,
  vec3.copy(posState.__renderPosition, local);
}
