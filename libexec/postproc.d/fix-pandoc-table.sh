#!/bin/bash

set -e

file=$1

# Delete width= from <col> and <table>

sed -i '/^<col/s/ width=".*"//g;/^<table/s/style=".*"//g' "$1"
sed -i '/colgroup/,/\/colgroup/ d' "$1"

exit 0
