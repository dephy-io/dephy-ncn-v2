import {
  addPdasVisitor, 
  constantPdaSeedNodeFromString,
  publicKeyTypeNode, 
  variablePdaSeedNode,
} from 'codama';


export const pdas = addPdasVisitor({
  dephyRewards: [{
    name: 'rewardsVault',
    seeds: [
      constantPdaSeedNodeFromString('utf8', "rewards_vault"),
      variablePdaSeedNode('rewards_state', publicKeyTypeNode()),
    ]
  }, {
    name: 'claimState',
    seeds: [
      constantPdaSeedNodeFromString('utf8', "claim_state"),
      variablePdaSeedNode('rewards_state', publicKeyTypeNode()),
      variablePdaSeedNode('user', publicKeyTypeNode()),
    ]
  }]
})

export default {
  idl: '../target/idl/dephy_rewards.json',
  before: [
    './dephy-rewards.js#pdas',
  ],
  scripts: {
    js: {
      from: '@codama/renderers-js',
      args: [
        'clients/dephy-rewards/js/src/generated',
      ]
    },
  }
}
