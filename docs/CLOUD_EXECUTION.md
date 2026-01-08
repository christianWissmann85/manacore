# Cloud Execution Guide

This guide explains how to run ManaCore experiments on a DigitalOcean cloud server using Docker. This is the recommended workflow for long-running experiments (e.g., the MCTS tuning pipeline) so they don't occupy your local machine.

## 1. Quick Server Setup (DigitalOcean)

1.  **Create Droplet:** Log in to DigitalOcean and create a new Droplet.
2.  **Choose Image:** Go to the **Marketplace** tab and search for **"Docker"**. Select "Docker on Ubuntu".
3.  **Choose Size:**
    - **Recommended:** CPU-Optimized (4 GB RAM / 2 vCPUs) or higher.
4.  **Launch:** Create the droplet and copy its IP address.

## 2. Deploying Code

Open a terminal on your local machine and connect to the server (replace `x.x.x.x` with your IP):

```bash
ssh root@x.x.x.x

```

Clone your repository:

```bash
git clone [https://github.com/christianwissmann85/manacore.git](https://github.com/christianwissmann85/manacore.git)
cd manacore

```

## 3. Running Experiments (The "Set & Forget" Method)

We run experiments in **Detached Mode** (`-d`). This runs the process in the background, allowing you to close your terminal or turn off your computer without stopping the experiment.

**Step 1: Build the Image**

```bash
docker build -t manacore .

```

**Step 2: Start the Run**
Use this command to start the tuning pipeline in the background:

```bash
docker run -d --name tuning-run \
  -v "$(pwd)/output:/app/output" \
  -v "$(pwd)/experiments:/app/experiments" \
  manacore run experiments/mcts-greedy-tuning-pipeline.json

```

**Step 3: Check Status**
To see what the bot is doing (view the logs):

```bash
docker logs -f tuning-run

```

_(Press `Ctrl+C` to exit the log view. The bot will keep running!)_

## 4. Retrieving Results

When the experiment finishes (or whenever you want to check progress), copy the files from the server to your local machine.

**Run this command on your LOCAL computer (not the server):**

```bash
# Example: Copy the entire pipeline output folder
scp -r root@your-server-ip:~/manacore/output/pipeline ./local-results/

```

## 5. Cost Saving: Cleaning Up

**Crucial:** Cloud providers charge you as long as the server **exists**, even if it is turned off.

1. **Verify you have your data:** Ensure you have run the `scp` command above and see the files on your laptop.
2. **Destroy the Droplet:**

- Go to the DigitalOcean Dashboard.
- Click on your Droplet.
- Select **"Destroy"** from the left menu.
- Confirm destruction.

_This ensures you only pay for the hours you used (usually <$1.00 per run)._

---

## Guide: Going Forward with Cloud Tuning

Here is your "Standard Operating Procedure" for the future:

#### 1. When to run this?

You don't need to run this every day. Run the pipeline **Once every 2 weeks** OR after these specific events:

- **New Mechanics:** You implemented a big new feature (e.g., "Flying" or "Triggers").
- **Major Bug Fix:** You fixed a logic error that was causing the bot to play badly.
- **Before a "Release":** If you want to show off the bot to friends or release a new version, run a fresh tune to make it as smart as possible.

#### 2. The Workflow

1.  **Coding Phase:** Work on your laptop (Ryzen AI beast!) for development and quick tests (`bun test`).
2.  **Tuning Phase:**
    - Commit & Push your code.
    - Spin up a DigitalOcean Droplet (takes ~60 seconds).
    - SSH in, `git clone`, and run the **Detached Command** (from section 3 above).
    - **Go to sleep.** 😴
    - Next morning: `scp` results down.
    - **DESTROY** the droplet immediately.

#### 3. Why is "Stage 3" slow?

This is the **MCTS Parameter Tuning** stage.

- It plays actual games of Magic (unlike Stage 2, which just does math on static weights).
- Playing 50-100 games of Magic takes time, even for a computer!
