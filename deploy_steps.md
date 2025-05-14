# Dephy-Ncn Deployment Steps

## Local test preparation steps


```sh
solana airdrop -u l 10 tests/fixtures/keys/jito-admin.json
solana airdrop -u l 10 tests/fixtures/keys/op0-admin.json
solana airdrop -u l 10 tests/fixtures/keys/op1-admin.json
solana airdrop -u l 10 tests/fixtures/keys/user.json
solana airdrop -u l 10 tests/fixtures/keys/vault-admin.json
```

```sh
jito-restaking-cli restaking config initialize
jito-restaking-cli vault config initialize 10 $(solana address)
```


### Init Jito Vault

```sh
spl-token -u l create-token --decimals 6
# note mint address
spl-token -u l create-account <mint>
spl-token -u l mint <mint> 1000

spl-token -u l create-account --owner tests/fixtures/keys/user.json <mint>
spl-token -u l mint --recipient-owner tests/fixtures/keys/user.json <mint> 1000
```

```sh
jito-restaking-cli vault vault initialize <mint> 0 0 0 6 1
# note vault address
```

### Init operators

```sh
jito-restaking-cli restaking operator initialize 1000 --keypair tests/fixtures/keys/op0-admin.json
# note operator address

# connect vault and operators
jito-restaking-cli restaking operator initialize-operator-vault-ticket --keypair tests/fixtures/keys/op0-admin.json <operator_pubkey> <vault_pubkey>
jito-restaking-cli restaking operator warmup-operator-vault-ticket --keypair tests/fixtures/keys/op0-admin.json <operator_pubkey> <vault_pubkey>

jito-restaking-cli vault vault initialize-operator-delegation <vault_pubkey> <operator_pubkey>
```

## Steps

1.  init ncn
    ```sh
    bun dephy-ncn initialize-ncn -k <ncn_admin_keypair>
    # note config, ncn address
    ```

2. connect vault
    ```sh
    bun dephy-ncn initialize-vault -k <ncn_admin_keypair> -c <config_pubkey> -v <vault_pubkey>
    bun dephy-ncn warmup-vault -k <ncn_admin_keypair> -c <config_pubkey> -v <vault_pubkey>
    ```

3. wait vault side connect to ncn
    ```sh
    # local test step
    jito-restaking-cli vault vault initialize-vault-ncn-ticket <vault_pubkey> <ncn_pubkey>
    jito-restaking-cli vault vault warmup-vault-ncn-ticket <vault_pubkey> <ncn_pubkey>
    ```

4. connect operators
    ```sh
    bun dephy-ncn initialize-operator -k <ncn_admin_keypair> -c <config_pubkey> -o <operator_pubkey>
    ```

    ```sh
    # local test step
    bun dephy-ncn warmup-operator -k <ncn_admin_keypair> -c <config_pubkey> -o <operator_pubkey>
    ```

5. user mint
    ```sh
    # local test step
    jito-restaking-cli vault vault mint-vrt --keypair tests/fixtures/keys/user.json <vault_pubkey> <amount> <amount>
    ```

6. delegate to operator
    ```sh
    # local test step
    jito-restaking-cli vault vault delegate-to-operator <vault_pubkey> <operator_pubkey> <amount>
    ```

7. vote
    ```sh
    bun dephy-ncn vote -c <config_pubkey> -o <operator_pubkey> -v <vault_pubkey> --rewards-root <rewards_root_hex> -k <operator_admin_keypair>
    ```

