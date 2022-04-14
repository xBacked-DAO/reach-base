import { loadStdlib } from '@reach-sh/stdlib';
import * as backend from './build/base.main.mjs';
import { ask, done } from '@reach-sh/stdlib/ask.mjs';
import esMain from 'es-main';
import dotenv from 'dotenv';

dotenv.config();

const stdlib = loadStdlib(process.env);

const MICRO_UNITS = 1000000;
const convertToMicroUnits = (amt) => Math.round(amt * MICRO_UNITS);
const convertFromMicroUnits = (amt) => amt / MICRO_UNITS;

const baseInteractions = async({ acc, contractID, logger }) => {

  // When running on interactive mode (CLI). Only shows up if contractID is not specified in process.env
  if (!contractID) {
    contractID = await ask(
      'Please paste the contract address',
      (x => parseInt(x))
    );
  }

  console.log(`==== CONNECTED AS ====> ${acc.networkAccount.addr}`);

  const action = await ask(
    `Do you want to
    1) Deprecate the contract
    2) ...\n
  `,
    (x => parseInt(x))
  );

  try {
    const ctc = acc.contract(backend, contractID);
    const get = ctc.v.State;
    const adminApi = ctc.a.AdminAPI;
    // more APIs here
    const events = ctc.e.Announcer;
    // console.log(events);
    let stateViewBefore = await get.read();
    let stateViewAfter;

    const fmt = (x) => stdlib.formatCurrency(x, 3);
    const algoBal = await stdlib.balanceOf(acc);
    logger(`ALGO balance before: ${fmt(algoBal)}`);

    const vaultStateBefore = stateViewBefore[1];

    logger(JSON.stringify(vaultStateBefore, null, 2));

    switch(action) {
      case 1:
        
        const deprecate = await adminApi.deprecate(true);
        console.log(deprecate);
        break;
        default:
          throw new Error('Invalid action');
    }

    stateViewAfter = await get.read();
    const vaultStateAfter = stateViewAfter[1];
    if (stateViewAfter[0] !== "None") {
      console.log(JSON.stringify(vaultStateAfter, null, 2));
    }
    const algoBalAfter = await stdlib.balanceOf(acc);
    logger(`ALGO balance after: ${fmt(algoBalAfter)}\n\n`);

    done();
  } catch (e) {
    logger(e);
    done();
  }
};

// Test if an ES module is run directly with node. Acts as a replacement
// for require.main not available in ES.
// Allows the module to be imported for testing.
if (esMain(import.meta)) {

  const deploymentEnv = process.env.DEPLOYMENT_ENV || 'LocalHost';
  stdlib.setProviderByName(deploymentEnv);
  console.log(`====USING ${deploymentEnv}====\n\n`);

  // Use this to test owner validation
  const adminPassphrase = process.env.ADMIN_ACC;
  const acc = await stdlib.newAccountFromMnemonic(adminPassphrase);
  // const acc = await stdlib.createAccount();
  if (await stdlib.canFundFromFaucet()) {
    await stdlib.fundFromFaucet(acc, stdlib.parseCurrency(3000));
  }

  const contractID = parseInt(process.env.CONTRACT_ID);

  const baseApi = async() => await baseInteractions({
    acc,
    contractID,
    logger: (text) => { console.log(text); },
  });
  baseApi();
}

export default baseInteractions;
