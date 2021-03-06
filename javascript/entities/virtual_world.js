// Copyright 2015 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

// Range of private virtual world that can be reserved by features for private usage. A ring-buffer
// will be created for storing the available virtual worlds.
const EXCLUSIVE_VIRTUAL_WORLD_BASE = 10000000;
const EXCLUSIVE_VIRTUAL_WORLD_RANGE = 500;

// Object containing all acquired virtual worlds.
let acquiredVirtualWorlds = {};

// A virtual world is a separated dimension in the San Andreas world, featuring its own entities,
// environment (weather, time) and other properties.
class VirtualWorld {
  // Acquires an exclusive Virtual World id that can be used by the feature. A description must be
  // given, so that leaky features can be detected through debugging.
  static acquire(description) {
    // TODO: This could be an O(1) operation when using a ring buffer, rather than the O(n) it
    // is today, with n being the number of exclusive virtual worlds (worst case only).
    for (let worldOffset = 0; worldOffset < EXCLUSIVE_VIRTUAL_WORLD_RANGE; ++worldOffset) {
      let worldId = worldOffset + EXCLUSIVE_VIRTUAL_WORLD_BASE;
      if (acquiredVirtualWorlds.hasOwnProperty(worldId))
        continue;

      acquiredVirtualWorlds[worldId] = description;
      return worldId;
    }

    // Throw an exception if no virtual worlds were available.
    throw new Error('No virtual worlds were available for allocation to the feature.');
  }

  // Releases a virtual world, which means that other parts of the gamemode will be able to use it.
  static release(worldId) {
    delete acquiredVirtualWorlds[worldId];
  }
};

// Expose the VirtualWorld object as a global.
global.VirtualWorld = VirtualWorld;
