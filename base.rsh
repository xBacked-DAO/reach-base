'reach 0.1';

/**
 * All functions used to configure the contract upon deployment
 */
const AdminInteract = {
  ...hasConsoleLogger,
  setFee: Fun([], UInt),
  // Indicates to the frontend the contract has been deployed.
  isInitialized: Fun([Contract], Null),
  // A Fun that that throws an exception allowing the
  // frontend to exit the thread.
  ready: Fun([], Null)
};

const userState = Struct([['userId', UInt]]);

export const main = Reach.App(() => {
  // Compilation options for Reach
  setOptions({
    untrustworthyMaps: true,
    connectors: [ALGO]
  });

  const Admin = Participant('Admin', {
    ...AdminInteract
  });

  const AdminAPI = API('AdminAPI', {
    deprecate: Fun([Bool], Bool),
    updateParams: Fun([Tuple(UInt)], Bool)
  });

  const Any = API('Any', {
    halt: Fun([], Null)
  });

  const ContractUser = API('ContractUser', {
    helloWorld: Fun([UInt], Bool)
  });

  const [isTxnType, DEPRECATE, UPDATE_PARAMS, HELLO] = makeEnum(3);
  const Announcer = Events('Announcer', {
    transaction: [Address, UInt]
  });

  const ContractState = Struct([
    ['adminParams', Tuple(UInt)],
    ['deprecated', Bool]
  ]);

  const State = View('State', {
    read: ContractState,
    readUser: Fun([Address], Data({ None: Null, Some: userState }))
  });

  init();

  Admin.publish();
  commit();

  Admin.only(() => {
    const adminAddress = this;

    const initialFee = declassify(interact.setFee());
  });

  // These are the variables we can change per contract deployment
  Admin.publish(adminAddress, initialFee);

  const contractUsers = new Map(userState);
  // use this when doing fromSome(contractUsers)
  const emptyUser = userState.fromObject({ userId: 0 });
  // Define the function to return a users state
  State.readUser.set((addr) => contractUsers[addr]);
  commit();

  const getCollateralBalance = () => balance();
  const createPaymentExpression = (collateralAmt, tokenAmt) => [
    collateralAmt
    // [tokenAmt, tok]
  ];

  assert(getCollateralBalance() == 0);

  Admin.publish();
  Admin.interact.isInitialized(getContract());
  Admin.interact.ready();

  const [deprecated, adminParams] = parallelReduce([false, [5]])
    .define(() => {
      const [fee] = adminParams;

      State.read.set(
        ContractState.fromObject({
          adminParams,
          deprecated
        })
      );

      const isAdmin = (who) =>
        check(who == adminAddress, 'You are not the admin');
      const isNotDeprecated = () => check(!deprecated, 'This is deprecated');
    })
    // .paySpec([tok])
    .invariant(balance() >= 0)
    // vault only ends when deprecated, or when collat is zero (all withdrawn)
    .while(!deprecated || balance() != 0)
    .api(
      AdminAPI.deprecate,
      (_) => {
        isAdmin(this);
      },
      (_) => {
        return createPaymentExpression(0, 0);
      },
      (deprecateVal, apiReturn) => {
        isAdmin(this);
        Announcer.transaction(this, DEPRECATE);
        apiReturn(true);
        return [deprecateVal, adminParams];
      }
    )
    .api(
      AdminAPI.updateParams,
      (_) => {
        isAdmin(this);
      },
      (_) => {
        return createPaymentExpression(0, 0);
      },
      // frontend must format the array of Maybe(Address)
      (updatedParams, apiReturn) => {
        isAdmin(this);
        Announcer.transaction(this, UPDATE_PARAMS);
        apiReturn(true);
        return [deprecated, updatedParams];
      }
    )
    .api(
      ContractUser.helloWorld,
      (id) => {
        check(id > 0, 'id must be greater than 0');
      },
      (_) => {
        return createPaymentExpression(0, 0);
      },
      // frontend must format the array of Maybe(Address)
      (id, apiReturn) => {
        check(id > 0, 'id must be greater than 0');
        contractUsers[this] = userState.fromObject({
          userId: id
        });
        Announcer.transaction(this, HELLO);
        apiReturn(true);
        return [deprecated, adminParams];
      }
    );

  assert(deprecated == true && balance() == 0);

  commit();
  const [[], haltK] = call(Any.halt);
  haltK(null);

  transfer(balance()).to(Admin);
  commit();
  exit();
});
