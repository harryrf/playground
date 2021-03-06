// Copyright 2006-2015 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the GPLv2 license, a copy of which can
// be found in the LICENSE file.

/**
 * Las Venturas Playground has two kinds of bank accounts. The normal accounts are available for
 * each player, whereas they can upgrade to a Premier bank account as they gain more experience
 * on the server. Both types of account will persist the balance between sessions.
 */
enum BankAccountType {
    NormalBankAccount,
    PremierBankAccount
};

/**
 * There are two kinds of bank accounts on Las Venturas Playground: normal accounts, available to
 * each and every registered player, and Premier accounts which are available for the more regular
 * players on the server. Both will persist the player's balance between playing sessions.
 *
 * Normal bank accounts have a maximum balance of 400 million dollars and are free to use at any
 * bank or cash point in San Andreas.
 *
 * Premier bank accounts have a maximum balance of 2 billion dollars but can be used anywhere and at
 * any time. However, when the player deposits money, 10% of that amount will go to the bank. Any
 * earnings from properties will directly be deposited in the player's bank account. Players are
 * able to upgrade to Premier accounts when they have a hundred hours of in-game time and are
 * willing to pay a one time fee of 150 million dollars.
 *
 * The commands for interacting with bank accounts are available in the BankCommands.pwn file,
 * including the available commands for administrators. This class holds the logic and status for
 * the bank account of each player, and is usable throughout the gamemode.
 */
class BankAccount <playerId (MAX_PLAYERS)> {
    // Maximum balance of a normal bank account: 400 million dollar.
    public const MaximumBalanceNormalAccount = 400000000;

    // Maximum balance of a Premier bank account: 2 billion dollar.
    public const MaximumBalancePremierAccount = 2000000000;

    // Percentage of the deposit which will go to the bank for Premier accounts.
    public const PremierDepositTransactionCostPercentage = 10.0;

    // How many hours does a player need to have before they can upgrade to a Premier account?
    public const RequiredHoursForPremierAccountUpgrade = 100;

    // What is the one-time cost of upgrading to a Premier bank account?
    public const RequiredMoneyForPremierAccountUpgrade = 150000000;

    // What is the pickup handler Id for the bank pickup?
    public const BankHandlerId = @counter(PickupHandler);

    // What kind of bank account does this player have?
    new BankAccountType: m_type;

    // What is the balance they currently have available in their account?
    new m_balance;

    // Is the player currently in the main bank building?
    new bool: m_inBank;

    /**
     * Creates the pickup necessary to determine whether someone is in the Las Venturas Playground
     * Central Bank building. We'll be using callbacks for verifying whether they are.
     */
    public __construct() {
        PickupController->createPickup(BankAccount::BankHandlerId, MainBankDollarPickupId,
            PersistentPickupType, 373.8596, 173.7510, 1008.3893, 0);
    }

    /**
     * Make sure that all information held by this class is reset when a new player connects to the
     * server, as we don't want players to be able to access the funds of a player before them.
     */
    @list(OnPlayerConnect)
    public onPlayerConnect() {
        m_type = NormalBankAccount;
        m_inBank = false;
        m_balance = 0;
    }

    /**
     * Returns the kind of bank account this player has.
     *
     * @return BankAccountType The bank account type for this player.
     */
    public inline BankAccountType: type() {
        return (m_type);
    }

    /**
     * Updates the bank account type for this player. This should only be used when the player logs
     * in to their account, upgrades their account or an Administrator does the latter for them.
     * After changing the type, the balance will be capped at the maximum value of the new type.
     *
     * @param type The type of bank account the player should have.
     */
    public setBankAccountType(BankAccountType: type) {
        m_type = type;

        if (m_type == NormalBankAccount && m_balance > BankAccount::MaximumBalanceNormalAccount)
            m_balance = BankAccount::MaximumBalanceNormalAccount;

        if (m_type == PremierBankAccount && m_balance > BankAccount::MaximumBalancePremierAccount)
            m_balance = BankAccount::MaximumBalancePremierAccount;
    }

    /**
     * Returns the balance currently available in the player's account. This will always have a
     * maximum of the account type the player currently has.
     *
     * @return integer The amount of money in the player's bank account.
     */
    public inline balance() {
        return (m_balance);
    }

    /**
     * Returns the maximum amount of money that can be deposited to the bank account. This value
     * effectively is equal to [maximum balance]-[current balance].
     *
     * @return integer The maximum amount of money the player can deposit.
     */
    public availableBalance() {
        if (m_type == PremierBankAccount)
            return max(0, BankAccount::MaximumBalancePremierAccount - m_balance);

        return max(0, BankAccount::MaximumBalanceNormalAccount - m_balance);
    }

    /**
     * Returns the maximum amount of money that the player can store in their account. This is
     * different based on the account type the player has.
     *
     * @return integer The maximum amount of money the player can store.
     */
    public maximumBalance() {
        if (m_type == PremierBankAccount)
            return BankAccount::MaximumBalancePremierAccount;

        return BankAccount::MaximumBalanceNormalAccount;
    }

    /**
     * Update the amount of money the player has in their account. After setting the new balance,
     * this method will make sure that we stay within the caps of the player's account type.
     *
     * @param balance The new amount of money in the player's account.
     * @return boolean Were we able to update the player's balance to the given value?
     */
    public bool: setBalance(balance) {
        if (balance < 0)
            return false; // we don't accept negative balances.

        if (m_type == NormalBankAccount)
            m_balance = min(balance, BankAccount::MaximumBalanceNormalAccount);

        if (m_type == PremierBankAccount)
            m_balance = min(balance, BankAccount::MaximumBalancePremierAccount);

        return true;
    }

    /**
     * Returns whether the player currently is in the main bank building. This will be used by the
     * bank commands to determine whether the /account command can be used.
     *
     * @return boolean Is the player currently in the bank building?
     */
    public inline bool: inBank() {
        return m_inBank;
    }

    /**
     * When a player enters the bank checkpoint, mark them as being in the bank so commands work and
     * give them a brief overview of the options available to them.
     *
     * @param pickupId Id of the pickup they started touching. Unused.
     * @param extraId Additional Id allowing features to route this pickup.
     */
    @switch(OnPlayerEnterPickup, BankAccount::BankHandlerId)
    public onPlayerEnterBank(pickupId, extraId) {
        m_inBank = true;

        // Announce the options to them in an information box.
        ShowBoxForPlayer(playerId, "Welcome to the Las Venturas Playground Main Bank. Please type ~r~/account~w~ to get started.");
        #pragma unused pickupId, extraId
    }

    /**
     * When a player leaves the bank's checkpoint again, mark them as having left the bank, making
     * sure that the /account command no longer works.
     *
     * @param pickupId Id of the pickup they left. Unused.
     * @param extraId Additional Id allowing features to route this pickup.
     */
    @switch(OnPlayerLeavePickup, BankAccount::BankHandlerId)
    public onPlayerLeaveBank(pickupId, extraId) {
        m_inBank = false;

        #pragma unused pickupId, extraId
    }
};
