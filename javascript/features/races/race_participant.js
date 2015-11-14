// Copyright 2015 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

// Represents an individual participant in a race. This class may be used to represent participants
// who are no longer connected to Las Venturas Playground, so be careful to not rely on the
// availability of the Player object used to represent them.
class RaceParticipant {
  constructor(player) {
    this.playerId_ = player.id;
    this.playerName_ = player.name;
    this.userId_ = null;

    if (player.isRegistered())
      this.userId_ = player.account.userId;

    this.state_ = RaceParticipant.STATE_SIGNUP;

    this.startTime_ = null;
    this.totalTime_ = null;
    this.rank_ = 0;

    this.checkpointIndex_ = null;
    this.checkpointTimes_ = [];
  }

  // Returns the Id of the player this participant represents.
  get playerId() { return this.playerId_; }

  // Returns the name of the player this participant represents.
  get playerName() { return this.playerName_; }

  // Returns the player associated with this participant. If they are no longer connected to the
  // server, or the player id has been recycled since, an exception will be thrown.
  get player() {
    let player = Player.get(this.playerId_);
    if (player === null || !this.isPlayer(player))
      throw new Error('The player this participant once represented is no longer connected.');

    return player;
  }

  // Returns the user Id of the account that belongs to this participant.
  get userId() { return this.userId_; }

  // Returns the state of this participant.
  get state() { return this.state_; }

  // Returns the time at which the participant started racing.
  get startTime() { return this.startTime_; }

  // Returns the total time this participant took for finishing the race.
  get totalTime() { return this.totalTime_; }

  // Returns or updates the participant's rank on this race. Will only be set after they finish it.
  get rank() { return this.rank_; }
  set rank(value) { this.rank_ = value; }

  // Returns the participant's current checkpoint index. May be NULL if they haven't passed one yet.
  get checkpointIndex() { return this.checkpointIndex_; }

  // Returns an array with the times at which the player passed each of the checkpoints.
  get checkpointTimes() { return this.checkpointTimes_; }

  // Determines whether |player| represents the player this instance represents. We can't rely on
  // the equality operator because the player for this participant may have disconnected since.
  isPlayer(player) {
    return this.playerId_ === player.id &&
           this.playerName_ === player.name;
  }

  // Records |time| as the moment at which the player passed the checkpoint at |checkpointIndex|.
  recordCheckpointTime(checkpointIndex, time) {
    this.checkpointIndex_ = checkpointIndex;
    this.checkpointTimes_.push(time - this.startTime_);
  }

  // Advances the player to |state|. If the current state is already past |state|, this call will
  // silently be ignored (don't demote players from having finished to having dropped out). The
  // |param| must be set when advancing to STATE_RACING or STATE_FINISHED.
  advance(state, param = null) {
    if (this.state_ >= state)
      return;

    this.state_ = state;
    switch (this.state_) {
      case RaceParticipant.STATE_RACING:
        this.startTime_ = param;
        break;

      case RaceParticipant.STATE_FINISHED:
        this.totalTime_ = param - this.startTime_;
        break;
    }
  }
};

// The states a player can be in whilst in a race.
RaceParticipant.STATE_SIGNUP = 0;
RaceParticipant.STATE_RACING = 1;
RaceParticipant.STATE_DROP_OUT = 2;
RaceParticipant.STATE_FINISHED = 3;

exports = RaceParticipant;