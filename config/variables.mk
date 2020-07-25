#
# TEMPLATING SYSTEM
#

RELEASE_CODENAME           = Lithium
RELEASE_CODENAME_LOWERCASE = $(shell echo $(RELEASE_CODENAME) | tr '[A-Z]' '[a-z]')
RELEASE_VERSION            = 10
RELEASE_DATE               = August 1st, 2020
RELEASE_ANNOUNCEMENT_URL   = https://forums.bunsenlabs.org/viewtopic.php?id=4772

DDL_BASE_URL               = https://ddl.bunsenlabs.org/ddl
ISO_BASE_NAME              = bl-$(RELEASE_CODENAME)$(RELEASE_VERSION)

ISO_32CD                   = lithium-1-cd-i386.hybrid.iso
ISO_32CD_TORRENTHASH       = 92b307a89bc3ecf1e3b90de1a8ce4d111935c3a9
ISO_64                     = lithium-1-amd64.hybrid.iso
ISO_64_TORRENTHASH         = 5cfc559232feece91bf04674321e54099f93f719

ISO_32CD_SIZE              = 682M
ISO_64_SIZE                = 1.28G

DDL_URL_32                 = $(DDL_BASE_URL)/$(ISO_32)
DDL_URL_32CD               = $(DDL_BASE_URL)/$(ISO_32CD)
DDL_URL_64                 = $(DDL_BASE_URL)/$(ISO_64)

SHA256SUMS = $(DDL_BASE_URL)/lithium-1.sha256sums.txt
SHA256SUMS_URL_32CD        = $(SHA256SUMS)
SHA256SUMS_URL_64          = $(SHA256SUMS)

SIG_URL_32CD               = $(DDL_URL_32CD).sig
SIG_URL_64                 = $(DDL_URL_64).sig

TORRENT_URL_32CD           = $(DDL_URL_32CD).torrent
TORRENT_URL_64             = $(DDL_URL_64).torrent

GALLERY = $(file < include/index/gallery.html)

### REFERENCED IN Makefile ###

RELEASE_SUBST :=             \
  DDL_URL_32                 \
  DDL_URL_32CD               \
  DDL_URL_64                 \
  GALLERY                    \
  GALLERY_NOSCRIPT           \
  ISO_32 ISO_64 ISO_32CD     \
  ISO_32_SIZE                \
  ISO_32CD_SIZE              \
  ISO_64_SIZE                \
  RELEASE_ANNOUNCEMENT_URL   \
  RELEASE_CODENAME           \
  RELEASE_CODENAME_LOWERCASE \
  RELEASE_DATE               \
  RELEASE_VERSION            \
  SHA256SUMS_URL_32          \
  SHA256SUMS_URL_32CD        \
  SHA256SUMS_URL_64          \
  SIG_URL_32                 \
  SIG_URL_32CD               \
  SIG_URL_64                 \
  TORRENT_URL_32             \
  TORRENT_URL_32CD           \
  TORRENT_URL_64             \
  ISO_32_TORRENTHASH         \
  ISO_32CD_TORRENTHASH       \
  ISO_64_TORRENTHASH         \
  NEWS
