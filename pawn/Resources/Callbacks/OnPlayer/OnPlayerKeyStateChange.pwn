// Copyright 2006-2015 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the GPLv2 license, a copy of which can
// be found in the LICENSE file.

#define KEY_SHIP_FIGHT 144

/**
 * Called when the state of any supported keys is changed, except for arrow keys.
 *
 * @param playerid Id of the player who pressed/released a key.
 * @param newkeys A map of the keys currently held.
 * @param oldkeys A map of the keys held prior to the current change.
 */
public OnPlayerKeyStateChange(playerid, newkeys, oldkeys) {
    if (Player(playerid)->isNonPlayerCharacter() == true)
        return 0;

    Annotation::ExpandList<OnPlayerKeyStateChange>(playerid, newkeys, oldkeys);

    // Determine whether this player is trying to enter or exit a remote controllable vehicle.
    // The RC Vehicle Manager has methods for controlling exactly that.
    if ((newkeys & KEY_SECONDARY_ATTACK) == KEY_SECONDARY_ATTACK) {
        if (IsPlayerInAnyVehicle(playerid)) {
            new vehicleId = GetPlayerVehicleID(playerid),
                vehicleModel = GetVehicleModel(vehicleId);

            // Is the player trying to exit an RC vehicle?
            if (VehicleModel(vehicleModel)->isRemoteControllableVehicle() == true) {
                RcVehicleManager->requestLeaveVehicle(playerid, vehicleId);
                return 1;
            }

        // Otherwise the player may be trying to enter an RC vehicle.
        } else if (RcVehicleManager->requestEnterVehicle(playerid) == true)
            return 1;
    }

    // Spraytags
    if (sprayTagOnKeyStateChange(playerid, newkeys, oldkeys))
        return 1;

    // Haystack
    if (hayOnPlayerPunch(playerid, newkeys, oldkeys))
        return 1;

    // Drinking
    CDrink__OnKey(playerid, newkeys);

    // Robbery
    CRobbery__OnKey(playerid, newkeys);

    // Derby
    CDerby__KeyStateChange(playerid, newkeys);

    // Ramping
    if (PRESSED(KEY_ACTION))
        OnPlayerPressRampKey(playerid);

    // Carbombs
    CBomb__DetonateCheck(playerid, newkeys);

    // Player presses FIRE (LMB, LCTRL)
    if (PRESSED(KEY_FIRE) || (PRESSED(KEY_FIRE) && PRESSED(KEY_SECONDARY_ATTACK))) {
        if (GetPlayerState(playerid) == PLAYER_STATE_ONFOOT) {
            if (CHideGame__GetPlayerState(playerid) == HS_STATE_PLAYING) {
                CHideGame__onPlayerPunch(playerid);
                return 1;
            }

            // Anti-ship fighting
            if (ShipManager->isPlayerWalkingOnShip(playerid)) {
                if (!sKillTime && (GetPlayerVirtualWorld(playerid) == 0)
                    && !IsPlayerInMinigame(playerid) && Player(playerid)->isModerator() == false
                    && !iPlayerAnimation[playerid] && 
                    ((GetPlayerSpecialAction(playerid) == SPECIAL_ACTION_NONE) || (GetPlayerSpecialAction(playerid) == SPECIAL_ACTION_DUCK)))
                    ClearAnimations(playerid, 0);
            }

            if (iPlayerAnimation[playerid])
                iPlayerAnimation[playerid] = 0;

            if (GetPlayerWeapon(playerid) >= 16) {
                LastShot[playerid] = Time->currentTime();

                if (playerTaxi[playerid][0] > -1 && playerTaxi[playerid][1] < 5) {
                    CancelTaxi(playerid);
                    SendClientMessage(playerid, Color::Error, "You scared off the taxi driver because you're shooting!");
                }
            }
        }
#if Feature::DisableRaces == 0
        else if (GetPlayerState(playerid) == PLAYER_STATE_DRIVER)
            CheckVehicleMissileFire(playerid, GetPlayerVehicleID(playerid));
#endif
    }

    // Other fighting style (punch + kick combo)
    if (PRESSED(KEY_SHIP_FIGHT) && ShipManager->isPlayerWalkingOnShip(playerid)) {
        if (!sKillTime && (GetPlayerVirtualWorld(playerid) == 0)
            && !IsPlayerInMinigame(playerid) && Player(playerid)->isModerator() == false
            && !iPlayerAnimation[playerid] && GetPlayerSpecialAction(playerid) == 0) {
            iPlayerAnimation[playerid] = 0;
            ClearAnimations(playerid, 0);
        }

        if (CHideGame__GetPlayerState(playerid) == HS_STATE_PLAYING) {
            CHideGame__onPlayerPunch(playerid);
            return 1;
        }
    }

    // Player sync
    if ((newkeys & (KEY_HANDBRAKE | KEY_JUMP)) == (KEY_HANDBRAKE | KEY_JUMP)
        && (oldkeys & (KEY_HANDBRAKE | KEY_JUMP)) != (KEY_HANDBRAKE | KEY_JUMP)) {
        if (Player(playerid)->isModerator() == true && GetPlayerWeapon(playerid) == 0 && !IsPlayerInAnyVehicle(playerid))
            PlayerSyncHandler->syncPlayer(playerid);

        return 1;
    }

    return 1;
}