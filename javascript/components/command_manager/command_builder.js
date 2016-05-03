// Copyright 2015 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

let StringParser = require('base/string_parser.js');

// Parses the first word in |argumentString| as either the id or the name of a player. Returns the
// player when successful, or fails when the player is not connected to the server.
function PlayerParser(argumentString) {
  let result = StringParser.WORD_MATCH.exec(argumentString);
  if (result === null)
    return [argumentString, null];

  let player = server.playerManager.find({ nameOrId: result[0], returnPlayer: true });
  if (player === null)
    return [argumentString, null];

  return [argumentString.substr(result[0].length), player];
}

// The command builder provides a convenient interface to build commands on, together with all the
// options that are possible to have for commands. A variety of checks will be done to ensure that
// the command will work consistently and reliably.
class CommandBuilder {
  constructor(level, parent, command, defaultValue = null) {
    this.level_ = level;
    this.parent_ = parent;

    this.command_ = command;
    this.defaultValue_ = defaultValue;

    this.restrictLevel_ = Player.LEVEL_PLAYER;

    this.parameters_ = [];
    this.parameterParser_ = null;

    this.listener_ = null;

    this.subCommands_ = [];
    this.hasWordSubcommand_ = false;
  }

  // Returns a human readable name of the command that's currently in process of being build.
  get name() {
    if (this.level_ == CommandBuilder.COMMAND)
      return '/' + this.command_;

    // TODO: Provide a name for *_PARAMETER values.
    let name = this.command_;

    // Append our name to the name of our parent.
    return this.parent_.name + ' ' + name;
  }

  // Restricts usage of the command to the given player level.
  restrict(level) {
    if (typeof level != 'number' || level < Player.LEVEL_PLAYER || level > Player.LEVEL_MANAGEMENT)
      throw new Error('Invalid player level supplied: ' + level);

    this.restrictLevel_ = level;
    return this;
  }

  // Sets |parameters| as the parameters accepted by the command. The |parameters| need to be in the
  // format accepted by the StringParser, although the accepted types are aliased to the command
  // builder, and the PLAYER_PARAMETER is accepted as well.
  parameters(parameters) {
    if (!Array.isArray(parameters))
      throw new Error('The list of parameters is expected to be an array.');

    let format = [];

    // Iterate over all passed parameters to validate their correctness, store its name and whether
    // it's required in the local parameters array, and append their type to the format.
    parameters.forEach(parameter => {
      if (typeof parameter != 'object' || Array.isArray(parameter))
        throw new Error('Individual parameters need to be objects.');

      if (!parameter.hasOwnProperty('name') || !parameter.hasOwnProperty('type'))
        throw new Error('Individual parameters need at least a name and a type.');

      let optional = parameter.hasOwnProperty('optional') ? !!parameter.optional : false;
      let type = parameter.type,
          parser = null;

      // If the type of this parameter is a player, pull in our own custom parser.
      if (type == CommandBuilder.PLAYER_PARAMETER) {
        type = CommandBuilder.CUSTOM_PARAMETER;
        parser = PlayerParser;
      }

      // Store the formatting rule that will be used to construct the parser.
      format.push({ type, parser, optional });

      // Store the name and requiredness of this parameter locally for usage messages.
      this.parameters_.push({ name: parameter.name, optional: optional });
    });

    this.parameterParser_ = new StringParser(format);
    return this;
  }

  // Creates a new sub-command for the current command builder. The |subCommand| must be unique and,
  // when |defaultValue| is used, unambiguous from any of the other registered commands.
  sub(subCommand, defaultValue = null) {
    if (typeof subCommand == 'number' && !CommandBuilder.ALLOWED_SUBCOMMANDS.includes(subCommand))
      throw new Error('Invalid sub-command type passed (only NUMBER, WORD and PLAYER are allowed).');

    if (defaultValue !== null) {
      if (typeof subCommand != 'number')
        throw new Error('Default sub-command values only make sense with one of the CommandBuilder.*_PARAMETER values.');

      if (typeof defaultValue != 'function')
        throw new Error('Default values must be provided through a function that takes a player.');
    }

    return new CommandBuilder(CommandBuilder.SUB_COMMAND, this, subCommand, defaultValue);
  }

  // Internal API for adding |subCommand| to the list of known sub-commands. The |listener| will be
  // invoked when the |subCommand| is executed by the user.
  registerSubCommand(builder, listener) {
    // Ensures that |subCommand| is unambiguous in context of |this|. Will throw an exception if the
    // command cannot be resolved unambiguously.
    this.ensureUnambiguous(this, builder);

    // If |builder| has a default value *and* sub-commands, we also need to verify that each of the
    // sub-commands are not ambiguous with commands already known in this builder.
    if (builder.defaultValue_ !== null) {
      builder.subCommands_.forEach(subCommand =>
          this.ensureUnambiguous(this, subCommand.builder));
    }

    // No further parameters may be added if the command represented by |builder| is a catch-all
    // word parameter, because that causes ambiguity in the execution order.
    if (builder.command_ == CommandBuilder.WORD_PARAMETER)
      this.hasWordSubcommand_ = true;

    this.subCommands_.push({ builder, listener });
  }

  // Verifies that |command| is unambiguous with any other command registered in the |builder|. Will
  // check recursively for parameters that have a default value.
  ensureUnambiguous(builder, newCommand) {
    if (builder.hasWordSubcommand_)
      throw new Error('"' + newCommand.name + '" must be defined before the WORD_PARAMETER command.');

    for (let subCommand of builder.subCommands_) {
      if (subCommand.builder.defaultValue_ !== null)
        this.ensureUnambiguous(subCommand.builder, newCommand);

      if (subCommand.builder.command_ == newCommand.command_)
        throw new Error('"' + newCommand.name + '" is ambiguous with "' + subCommand.builder.name + '".');
    }
  }

  // Builds the command constructed by this builder, invoking |commandListener| when it gets used.
  // Top-level commands will be registered with the command manager, whereas sub-commands will be
  // registered with their parent command.
  build(commandListener) {
    this.listener_ = commandListener || null;

    // Builds the listener function that handles dispatching for the current command.
    let listener = this.createListener();

    this.level_ == CommandBuilder.SUB_COMMAND
        ? this.parent_.registerSubCommand(this, listener)
        : this.parent_.registerCommand(this.command_, listener);

    return this.parent_;
  }

  // Internal implementation for creating the listener function. Each listener function follows the
  // same pattern of 
  createListener() {
    return (player, argumentString, carriedArguments = []) => {
      // Make sure that any leading padding is removed from |args|.
      argumentString = argumentString.trim();

      // When a level restriction is in effect for this command and the player does not meet the
      // required level, bail out immediately. This clause only hits for the main command.
      if (this.restrictLevel_ > player.level) {
        player.sendMessage(Message.format(Message.COMMAND_ERROR_INSUFFICIENT_RIGHTS, playerLevelToString(this.restrictLevel_, true /* plural */)));
        return true;
      }

      // Determine if there is a sub-command that we should delegate to. Word matching is used for
      // string values (which will be the common case for delegating commands.)
      for (let { builder, listener } of this.subCommands_) {
        if (builder.restrictLevel_ > player.level)
          continue;

        if (typeof builder.command_ == 'string') {
          let commandLength = builder.command_.length;
          if (!argumentString.startsWith(builder.command_) || (argumentString.length != commandLength && argumentString[commandLength] != ' '))
            continue;

          return listener(player, argumentString.substr(commandLength), carriedArguments);
        }

        let result = null;
        switch (builder.command_) {
          case CommandBuilder.NUMBER_PARAMETER:
            result = StringParser.NUMBER_MATCH.exec(argumentString);
            if (result === null)
              break;

            return listener(player, argumentString.substr(result[0].length), [ ...carriedArguments, parseFloat(result[0]) ]);

          case CommandBuilder.WORD_PARAMETER:
            result = StringParser.WORD_MATCH.exec(argumentString);
            if (result === null)
              break;

            return listener(player, argumentString.substr(result[0].length), [ ...carriedArguments, result[0] ]);

          case CommandBuilder.PLAYER_PARAMETER:
            result = StringParser.WORD_MATCH.exec(argumentString);
            if (result === null)
              break;

            let subject = server.playerManager.find({ nameOrId: result[0], returnPlayer: true });
            if (subject === null) {
              player.sendMessage(Message.COMMAND_ERROR_UNKNOWN_PLAYER, argumentString);
              return true;
            }

            return listener(player, argumentString.substr(result[0].length), [ ...carriedArguments, subject ]);
        }

        // If the sub-command has a default value function defined, attempt to get its value by
        // invoking it with |player|. Return values of NULL indicate that the value should not hit.
        if (builder.defaultValue_ !== null) {
          let value = builder.defaultValue_(player);
          if (value !== null)
            return listener(player, argumentString, [ ...carriedArguments, value ]);
        }
      }

      // Determine if parameters have been associated with this command. If that's the case, parse
      // and validate them. A generic usage message will be displayed if parsing failed.
      if (this.parameterParser_ !== null) {
        let parameters = this.parameterParser_.parse(argumentString, player);
        if (parameters === null) {
          player.sendMessage(Message.format(Message.COMMAND_USAGE, this.toString()));
          return true;
        }

        carriedArguments = [ ...carriedArguments, ...parameters ];
      }

      if (!this.listener_) {
        // TODO: Create a sensible default handler for the command. List accessible usage for
        // commands that have sub-commands, or display some sort of error message for commands with
        // which we really cannot do anything at all.
        return false;
      }

      this.listener_(player, ...carriedArguments);
      return true;
    };
  }

  // Converts the command represented by this builder to a string that could be used to tell players
  // what the intended usage, or syntax of the command is.
  toString() {
    let description = this.name;
    this.parameters_.forEach(parameter =>
        description += ' [' + parameter.name + ']');

    return description;
  }
};

// Used for top-level commands of the command builder.
CommandBuilder.COMMAND = 0;

// Used for sub-commands created using the command builder.
CommandBuilder.SUB_COMMAND = 1;

// The different kinds of dynamic arguments recognized by the command builder. These mimic the
// StringBuilder parameter types, except for the PLAYER type which uses a custom parser.
CommandBuilder.NUMBER_PARAMETER = StringParser.PARAM_TYPE_NUMBER;
CommandBuilder.WORD_PARAMETER = StringParser.PARAM_TYPE_WORD;
CommandBuilder.WORD_MATCH_PARAMETER = StringParser.PARAM_TYPE_WORD_MATCH;
CommandBuilder.SENTENCE_PARAMETER = StringParser.PARAM_TYPE_SENTENCE;
CommandBuilder.CUSTOM_PARAMETER = StringParser.PARAM_TYPE_CUSTOM;
CommandBuilder.PLAYER_PARAMETER = 42;

// Allowed argument types for sub-command identification. Sentences are not
// allowed here because they don't make sense as a sub-command - they should be
// parameters to a given command instead.
CommandBuilder.ALLOWED_SUBCOMMANDS = [CommandBuilder.NUMBER_PARAMETER,
                                      CommandBuilder.WORD_PARAMETER,
                                      CommandBuilder.PLAYER_PARAMETER];

exports = CommandBuilder;
