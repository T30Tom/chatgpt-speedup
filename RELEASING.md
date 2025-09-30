# How to cut a release

To create a GitHub Release (the Action zips the extension and attaches a checksum), tag a version and push the tag:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
git tag -a v0.1.0 -m "v0.1.0" creates an annotated tag locally named v0.1.0.

git push origin v0.1.0 pushes that tag to GitHub.

The Release workflow (triggered by tags matching v*) builds chatgpt-speedup-vX.Y.Z.zip,
generates SHA256SUMS.txt, and publishes a GitHub Release with those files attached.
