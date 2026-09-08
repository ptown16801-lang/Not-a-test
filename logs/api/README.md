# OpenAI API logs

`openai-interactions.jsonl` is a local runtime artifact and is excluded by the repository's existing `*.jsonl` ignore rule. It may contain scientific prompts/results but must never contain API credentials.

`cost-ledger.json` is a tracked aggregate ledger containing call counts and estimated USD totals by date and experiment. It contains no credentials and no raw prompts.
