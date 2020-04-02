#!/bin/bash

set -e

linkname=${1##*/}
linkname=${linkname%.html}

sed -i "/href.\+${linkname}/s/<a/<a class='selected'/" "$1"

exit 0
