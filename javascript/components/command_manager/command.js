// Copyright 2015 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

let StringParser = require('base/string_parser.js');

// Represents a command that can be executed by players. Each command has at least one prototype
// that has 
//
// Read the online documentation for more information on the parameter syntax:
//   https://github.com/LVPlayground/playground/tree/master/javascript/components/command_manager
class Command {
  constructor(name, prototypes) {
    this.name_ = name;

    // ...
  }

  // Returns the name of this command.
  get name() { return this.name_; }

  // Dispatches the command to the listener when the passed arguments are valid, or displays an
  // error message to the player when a problem has been found.
  dispatch(player, args) {
    

    // ...
  }

  // Converts the command back to a string. This string can be displayed to players to give them
  // information about how to execute the command.
  toString() {
    // ...
    return null;
  }
};

exports = Command;
