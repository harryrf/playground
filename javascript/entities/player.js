// Copyright 2015 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

const Extendable = require('base/extendable.js'),
      Vector = require('base/vector.js');

class Player extends Extendable {
  // Creates a new instance of the Player class for |playerId|.
  constructor(playerId) {
    super();

    this.id_ = playerId;
    this.name_ = pawnInvoke('GetPlayerName', 'iS', playerId);
    this.ipAddress_ = pawnInvoke('GetPlayerIp', 'iS', playerId);

    this.connected_ = true;
    this.disconnecting_ = false;

    this.level_ = Player.LEVEL_PLAYER;
    this.userId_ = null;

    this.activity_ = Player.PLAYER_ACTIVITY_NONE;
    this.messageLevel_ = 0;
  }

  // Returns the id of this player. This attribute is read-only.
  get id() { return this.id_; }

  // Returns whether the player is still connected to the server.
  isConnected() { return this.connected_; }

  // Returns whether the player is currently in process of disconnecting.
  isDisconnecting() { return this.disconnecting_; }

  // Marks the player as being in process of disconnecting from the server.
  notifyDisconnecting() {
    this.disconnecting_ = true;
  }

  // Marks the player as having disconnected from the server.
  notifyDisconnected() {
    this.connected_ = false;
    this.disconnecting_ = false;
  }

  // Returns or updates the name of this player. Changing the player's name is currently not
  // synchronized with the Pawn portion of the gamemode.
  get name() { return this.name_; }
  set name(value) { this.name_ = value; pawnInvoke('SetPlayerName', 'is', this.id_, value); }

  // Returns the IP address of this player. This attribute is read-only.
  get ipAddress() { return this.ipAddress_; }

  // Gets the level of this player. Synchronized with the gamemode using the `levelchange` event.
  get level() { return this.level_; }

  // Returns whether the player is registered and logged in to their account.
  isRegistered() { return this.userId_ !== null; }

  // Gets the user Id of the player's account if they have identified to it.
  get userId() { return this.userId_; }

  // Gets or sets the virtual world the player is part of.
  get virtualWorld() { return pawnInvoke('GetPlayerVirtualWorld', 'i', this.id_); }
  set virtualWorld(value) { pawnInvoke('SetPlayerVirtualWorld', 'ii', this.id_, value); }

  // Gets or sets the interior the player is part of. Moving them to the wrong interior will mess up
  // their visual state significantly, as all world objects may disappear.
  get interior() { return pawnInvoke('GetPlayerInterior', 'i', this.id_); }
  set interior(value) { pawnInvoke('SetPlayerInterior', 'ii', this.id_, value); }

  // Gets or sets the position of the player. Both must be used with a 3D vector.
  get position() { return new Vector(...pawnInvoke('GetPlayerPos', 'iFFF', this.id_)); }
  set position(value) { pawnInvoke('SetPlayerPos', 'ifff', this.id_, value.x, value.y, value.z); }

  // Gets or sets the time for this player. It will be returned, and must be set, as an array having
  // two entries: hours and minutes.
  get time() { return pawnInvoke('GetPlayerTime', 'iII', this.id); }
  set time(value) { pawnInvoke('SetPlayerTime', 'iii', this.id, value[0], value[1]); }

  // Sets the player's weather. We cannot provide a getter for this, given that SA-MP does not
  // expose whatever weather is current for the player. Silly.
  set weather(value) { pawnInvoke('SetPlayerWeather', 'ii', this.id_, value); }

  // Sets whether the player should be controllable. We cannot provide a getter for this, given that
  // SA-MP does not expose an IsPlayerControllable native. Silly.
  set controllable(value) { pawnInvoke('TogglePlayerControllable', 'ii', this.id_, value ? 1 : 0); }

  // Returns whether the player is in an vehicle. If |vehicle| is provided, this method will check
  // whether the player is in that particular vehicle. Otherwise any vehicle will do.
  isInVehicle(vehicle) {
    if (typeof vehicle === 'number')
      return pawnInvoke('GetPlayerVehicleID', 'i') == vehicle;

    // TODO: Handle Vehicle instances for |vehicle|.

    return pawnInvoke('IsPlayerInAnyVehicle', 'i', this.id_);
  }

  // Removes the player from the vehicle they're currently in.
  removeFromVehicle() { pawnInvoke('RemovePlayerFromVehicle', 'i', this.id_); }

  // Puts the player in |vehicle|, optionally defining |seat| as the seat they should sit in. If the
  // player already is in a vehicle, they will be removed from that before being put in the other in
  // order to work around a SA-MP bug where they may show up in the wrong vehicle for some players.
  putInVehicle(vehicle, seat = 0) {
    if (this.isInVehicle())
      this.removeFromVehicle();

    if (typeof vehicle === 'number')
      pawnInvoke('PutPlayerInVehicle', 'iii', this.id_, vehicle, seat);
    else if (vehicle instanceof Vehicle)
      pawnInvoke('PutPlayerInVehicle', 'iii', this.id_, vehicle.id, seat);
    else
      throw new Error('Unknown vehicle to put the player in: ' + vehicle);
  }

  // Plays |soundId| for the player at their current position.
  playSound(soundId) {
    pawnInvoke('PlayerPlaySound', 'iifff', this.id_, soundId, 0, 0, 0);
  }

  // Returns or updates the activity of this player. Updating the activity will be propagated to
  // the Pawn part of the gamemode as well.
  get activity() { return this.activity_; }
  set activity(activity) {
    this.activity_ = activity;

    // Inform the Pawn script of the activity change.
    pawnInvoke('OnPlayerActivityChange', 'ii', this.id_, activity);
  }

  // Gets the message level at which this player would like to receive messages. Only applicable
  // to administrators on the server.
  get messageLevel() { return this.messageLevel_; }

  // Displays the dialog for |caption| explained by |message| to the player.
  showDialog(dialogId, style, caption, message, leftButton, rightButton) {
    pawnInvoke('ShowPlayerDialog', 'iiissss', this.id_, dialogId, style, caption, message,
               leftButton, rightButton);
  }

  // Sends |message| to the player. The |message| can either be a scalar JavaScript value or an
  // instance of the Message class that exists in //base if you wish to use colors.
  sendMessage(message, ...args) {
    // TODO: Automatically split up messages that are >144 characters.
    // TODO: Verify that any formatting used in |message| is valid.

    if (message instanceof Message)
      message = Message.format(message, ...args);

    pawnInvoke('SendClientMessage', 'iis', this.id_, 0xFFFFFFFF, message.toString());
  }

  // -----------------------------------------------------------------------------------------------
  // TODO: The following methods should not be on the common Player object, but rather provided by
  // a feature of sorts.

  updateStreamer(position, virtualWorld, interiorId, type) {
    pawnInvoke('Streamer_UpdateEx', 'ifffiii', this.id_, position.x, position.y, position.z,
               virtualWorld, interiorId, type);
  }

};

// Invalid player id. Must be equal to SA-MP's INVALID_PLAYER_ID definition.
Player.INVALID_ID = 0xFFFF;

// The level of a player. Can be accessed using the `level` property on a Player instance.
Player.LEVEL_PLAYER = 0;
Player.LEVEL_ADMINISTRATOR = 1;
Player.LEVEL_MANAGEMENT = 2;

// The states a player can be in. Used by Player.state and `playerstatechange` events.
Player.STATE_NONE = 0;
Player.STATE_ON_FOOT = 1;
Player.STATE_DRIVER = 2;
Player.STATE_PASSENGER = 3;
Player.STATE_EXIT_VEHICLE = 4;
Player.STATE_ENTER_VEHICLE_DRIVER = 5;
Player.STATE_ENTER_VEHICLE_PASSENGER = 6;
Player.STATE_WASTED = 7;
Player.STATE_SPAWNED = 8;
Player.STATE_SPECTATING = 9;

// Loads the activities of a player and installs them on |Player|.
require('entities/player_activities.js')(Player);

// Called when a player's activity changes. This event is custom to Las Venturas Playground.
self.addEventListener('playeractivitychange', event => {
  const player = server.playerManager.getById(event.playerid);
  if (!player)
    return;

  player.activity_ = event.activity;
});

// Called when a player's message level changes. This event is custom to Las Venturas Playground.
self.addEventListener('messagelevelchange', event => {
  const player = server.playerManager.getById(event.playerid);
  if (!player)
    return;

  player.messageLevel_ = event.messagelevel;
});

// Utility function: convert a player's level to a string.
global.playerLevelToString = (level, plural = false) => {
  switch (level) {
    case Player.LEVEL_PLAYER:
      return plural ? 'players' : 'player';
    case Player.LEVEL_ADMINISTRATOR:
      return plural ? 'administrators' : 'administrator';
    case Player.LEVEL_MANAGEMENT:
      return plural ? 'Management members' : 'Management member';
  }

  throw new Error('Invalid player level supplied: ' + level);
};

// Expose the Player object globally since it will be commonly used.
global.Player = Player;
