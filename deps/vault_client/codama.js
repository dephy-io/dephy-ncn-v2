export default {
  idl: './jito_vault.json',
  before: [
  ],
  scripts: {
    rust: {
      from: '@codama/renderers-rust',
      args: [
        'deps/vault_client/src/generated',
        {
          crateFolder: 'deps/vault_client',
          formatCode: true,
          traitOptions: {
            scalarEnumDefaults: [
              'anchor_lang::InitSpace',
            ],
            structDefaults: [
              'anchor_lang::InitSpace',
            ],
          },
        }
      ]
    }
  }
}
