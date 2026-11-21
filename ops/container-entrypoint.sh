#!/bin/sh
set -eu
# Also applies when running the OAuth CLI instead of the API.
umask 077
exec "$@"
