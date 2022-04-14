import { loadStdlib } from '@reach-sh/stdlib';
import { ask, done } from '@reach-sh/stdlib/ask.mjs';
import * as backend from './build/base.main.mjs';
import esMain from 'es-main';
import dotenv from 'dotenv';

dotenv.config();

const stdlib = loadStdlib(process.env);

const frontend = async (acc, logger) => {

  const participant = backend.Admin;

  // Funding only works for private faucets. TESTNET accounts need to be funded
  // manually.
  if (await stdlib.canFundFromFaucet()) {
    await stdlib.fundFromFaucet(acc, stdlib.parseCurrency(100));
  }

  let ctc = null;

  // Prints the balance of the account
  const printBalance = async () => {
    const fmt = (x) => stdlib.formatCurrency(x, 3);
    const getBalance = async () => fmt(await stdlib.balanceOf(acc));

    const algoBal = await getBalance();
    logger(`\n\nYour ALGO balance is ${algoBal}`);
  };
  
  ctc = acc.contract(backend);
  ctc.getInfo().then(async (info) => {
    logger(`- Deployed vault: ${JSON.stringify(info.toNumber())}`);
    await printBalance();
  });

  const interact = {
    // could also use `ask` here
    setFee: () => 5,
    isInitialized: (contract) => console.log(`Deployed ${contract}`),
    ready: () => { throw 'Contract has been deployed'; }
  };

  await participant(ctc, {
      ...interact,
      ...stdlib.hasConsoleLogger
    }).catch(function (error) {
      logger('error', error);
    });

  await printBalance();

  done();
  logger('End of contract');
};

// Test if an ES module is run directly with node. Acts as a replacement
// for require.main not available in ES.
// Allows the module to be imported for testing.
if (esMain(import.meta)) {
  const deploymentEnv = process.env.DEPLOYMENT_ENV || 'LocalHost';
  stdlib.setProviderByName(deploymentEnv);
  console.log(`====DEPLOYING TO ${deploymentEnv}====\n\n`);

  // const acc = await stdlib.createAccount();
  const adminPassphrase = process.env.ADMIN_ACC;
  const acc = await stdlib.newAccountFromMnemonic(adminPassphrase);
  // Print for sending funds from faucer if using TESTNET
  console.log(`- Deploying with admin addr: ${acc.networkAccount.addr}`);

  frontend(
    acc,
    // Acts as a logger that forwards to console.log ignoring the event field
    (text) => { console.log(text); },
  );
}

export default frontend;
