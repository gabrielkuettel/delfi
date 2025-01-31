import type { Account, Asset, gtxn, uint64 } from '@algorandfoundation/algorand-typescript'
import {
  abimethod,
  arc4,
  assert,
  assertMatch,
  Global,
  GlobalState,
  itxn,
  LocalState,
  Txn,
  Uint64,
} from '@algorandfoundation/algorand-typescript'

/**
 * Oracle contract for handling data requests and whitelisting
 */
export class Oracle extends arc4.Contract {
  // Global state
  admin = GlobalState<Account>()
  watcher = GlobalState<Account>()
  fee = GlobalState<uint64>()

  // Local state
  isWhitelisted = LocalState<boolean>()

  /**
   * Initialize the contract with default values
   * @returns void
   */
  @abimethod({ onCreate: 'require' })
  public createApplication(): void {
    this.admin.value = Global.currentApplicationAddress
    this.watcher.value = Global.currentApplicationAddress
    this.fee.value = Uint64(1_000_000) // 1 ALGO in microalgos
  }

  /**
   * Request data from the oracle
   * @param payment Payment transaction for the request
   * @param pair The trading pair to request data for
   * @param callbackApp Asset ID of the callback application
   * @param callbackMethod Name of the callback method
   * @returns void
   */
  @abimethod({ allowActions: 'OptIn' })
  public requestData(payment: gtxn.PaymentTxn, pair: string, callbackApp: Asset, callbackMethod: string): void {
    assert(this.isWhitelisted(Txn.sender).value, 'Sender not whitelisted')

    // Verify payment transaction
    assertMatch(payment, {
      sender: Txn.sender,
      receiver: Global.currentApplicationAddress,
      amount: { greaterThanEq: this.fee.value },
    })

    const paymentAmount: uint64 = payment.amount - Uint64(1000) // Subtract fee

    // Forward payment to watcher
    itxn
      .payment({
        receiver: this.watcher.value,
        amount: paymentAmount,
        fee: Uint64(1000),
        note: 'oracle-request',
      })
      .submit()
  }

  /**
   * Opt in to the oracle application
   * @returns void
   */
  @abimethod({ allowActions: 'OptIn' })
  public optInToApplication(): void {
    // Initialize local state for the account opting in
    this.isWhitelisted(Txn.sender).value = true
  }

  /**
   * Set whitelist status for an account
   * @param account The account to modify whitelist status for
   * @param status True to whitelist, false to remove from whitelist
   * @returns void
   */
  @abimethod({ allowActions: 'NoOp' })
  public setWhitelist(account: Account, status: boolean): void {
    assert(Txn.sender === this.admin.value, 'Only admin can modify whitelist status')
    assert(account.isOptedIn(Global.currentApplicationId), 'Account must opt in to contract first')

    this.isWhitelisted(account).value = status
  }
}
