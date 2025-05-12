import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { useState, useEffect } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, Field, LoadingBar, RadioButtonGroup, Alert, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';

import { ShareExportTab } from '../ShareExportTab';

import { generateDashboardImage, ImageGenerationError } from './utils';

enum ImageFormat {
  PNG = 'png',
  JPG = 'jpg',
}

type ErrorState = {
  message: string;
  title: string;
  code?: ImageGenerationError;
} | null;

export class ExportAsImage extends ShareExportTab {
  public tabId = shareDashboardType.image;
  static Component = ExportAsImageRenderer;

  public getTabLabel() {
    return t('share-modal.tab-title.export-image', 'Export image');
  }
}

function ErrorAlert({ error }: { error: ErrorState }) {
  if (!error) {
    return null;
  }

  return (
    <Alert severity="error" title={error.title} data-testid={selectors.components.ExportImage.preview.error.container}>
      <div data-testid={selectors.components.ExportImage.preview.error.title}>{error.title}</div>
      <div data-testid={selectors.components.ExportImage.preview.error.message}>{error.message}</div>
    </Alert>
  );
}

function ImagePreview({ imageBlob, isLoading }: { imageBlob: Blob | null; isLoading: boolean }) {
  const styles = useStyles2(getStyles);

  if (!imageBlob || isLoading) {
    return null;
  }

  return (
    <img
      src={URL.createObjectURL(imageBlob)}
      alt={t('share-modal.image.preview', 'Preview')}
      className={styles.image}
      data-testid={selectors.components.ExportImage.preview.image}
      aria-label={t('share-modal.image.preview-aria', 'Generated dashboard image preview')}
      role="img"
    />
  );
}

function RendererAlert() {
  if (config.rendererAvailable) {
    return null;
  }

  return (
    <Alert
      severity="info"
      title={t('share-modal.link.render-alert', 'Image renderer plugin not installed')}
      data-testid={selectors.components.ExportImage.rendererAlert.container}
    >
      <div data-testid={selectors.components.ExportImage.rendererAlert.title}>
        {t('share-modal.link.render-alert', 'Image renderer plugin not installed')}
      </div>
      <div data-testid={selectors.components.ExportImage.rendererAlert.description}>
        <Trans i18nKey="share-modal.link.render-instructions">
          To render a dashboard image, you must install the{' '}
          <a
            href="https://grafana.com/grafana/plugins/grafana-image-renderer"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            Grafana image renderer plugin
          </a>
          . Please contact your Grafana administrator to install the plugin.
        </Trans>
      </div>
    </Alert>
  );
}

function ExportAsImageRenderer({ model }: SceneComponentProps<ExportAsImage>) {
  const [format, setFormat] = useState<ImageFormat>(ImageFormat.PNG);
  const [isLoading, setIsLoading] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<ErrorState>(null);
  const styles = useStyles2(getStyles);
  const [ref, { width: loadingBarWidth }] = useMeasure<HTMLDivElement>();

  const dashboard = getDashboardSceneFor(model);

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (imageBlob) {
        URL.revokeObjectURL(URL.createObjectURL(imageBlob));
      }
    };
  }, [imageBlob]);

  const onFormatChange = (value: ImageFormat) => {
    setFormat(value);
  };

  const onExport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await generateDashboardImage({
        dashboard,
        format,
        scale: config.rendererDefaultImageScale || 1,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setImageBlob(result.blob);
      DashboardInteractions.generateDashboardImageClicked({
        format,
        scale: config.rendererDefaultImageScale || 1,
        shareResource: 'dashboard',
        success: true,
      });
    } catch (error) {
      console.error('Error exporting image:', error);
      DashboardInteractions.generateDashboardImageClicked({
        format,
        scale: config.rendererDefaultImageScale || 1,
        shareResource: 'dashboard',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate image',
      });
      setError({
        title: t('share-modal.image.error-title', 'Failed to generate image'),
        message: error instanceof Error ? error.message : 'Failed to generate image',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onDownload = () => {
    if (!imageBlob) {
      return;
    }

    const time = new Date().getTime();
    const name = dashboard.state.title;
    saveAs(imageBlob, `${name}-${time}.${format}`);

    DashboardInteractions.downloadDashboardImageClicked({
      format,
      fileName: `${name}-${time}.${format}`,
      shareResource: 'dashboard',
    });
  };

  if (!config.rendererAvailable) {
    return <RendererAlert />;
  }

  return (
    <>
      <p className={styles.info}>
        <Trans i18nKey="share-modal.image.info-text">Save this dashboard as an image.</Trans>
      </p>

      <Field label={t('share-modal.image.format-label', 'Format')}>
        <div data-testid={selectors.components.ExportImage.formatOptions.container}>
          <RadioButtonGroup
            value={format}
            onChange={onFormatChange}
            options={[
              {
                label: 'PNG',
                value: ImageFormat.PNG,
                'data-testid': selectors.components.ExportImage.formatOptions.png,
              },
              {
                label: 'JPG',
                value: ImageFormat.JPG,
                'data-testid': selectors.components.ExportImage.formatOptions.jpg,
              },
            ]}
          />
        </div>
      </Field>

      <div className={styles.buttonRow}>
        {!imageBlob ? (
          <Button
            variant="primary"
            onClick={onExport}
            disabled={isLoading}
            icon="document-info"
            data-testid={selectors.components.ExportImage.buttons.generate}
          >
            <Trans i18nKey="share-modal.image.generate-button">Generate image</Trans>
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={onDownload}
            icon="download-alt"
            data-testid={selectors.components.ExportImage.buttons.download}
          >
            <Trans i18nKey="share-modal.image.download-button">Download image</Trans>
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={model.useState().onDismiss}
          fill="outline"
          data-testid={selectors.components.ExportImage.buttons.cancel}
        >
          <Trans i18nKey="share-modal.image.cancel-button">Cancel</Trans>
        </Button>
      </div>

      <div
        className={styles.previewContainer}
        ref={ref}
        data-testid={selectors.components.ExportImage.preview.container}
      >
        <div className={styles.loadingBarContainer} data-testid={selectors.components.ExportImage.preview.loading}>
          {isLoading && <LoadingBar width={loadingBarWidth} />}
        </div>

        {error && !isLoading && <ErrorAlert error={error} />}
        <ImagePreview imageBlob={imageBlob} isLoading={isLoading} />
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  info: css({
    marginBottom: theme.spacing(2),
  }),
  previewContainer: css({
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.secondary,
    minHeight: '300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  }),
  loadingBarContainer: css({
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 1,
  }),
  image: css({
    maxWidth: '100%',
    width: 'max-content',
    display: 'block',
  }),
  buttonRow: css({
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-start',
    marginBottom: theme.spacing(2),
  }),
});
