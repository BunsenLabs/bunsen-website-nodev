#!/bin/bash

set -e

sed -i 's/overflow-x: auto;//' "$1"

exit 0
