package alertrule

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alertrule/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	prom_model "github.com/prometheus/common/model"
)

func ConvertToK8sResource(
	orgID int64,
	rule *ngmodels.AlertRule,
	namespaceMapper request.NamespaceMapper,
) (*model.AlertRule, error) {
	k8sRule := &model.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			UID:       types.UID(rule.UID),
			Name:      rule.UID,
			Namespace: namespaceMapper(orgID),
		},
		Spec: model.Spec{
			Title:    rule.Title,
			Paused:   util.Pointer(rule.IsPaused),
			Data:     make(map[string]model.Query),
			Interval: model.PromDuration(strconv.FormatInt(rule.IntervalSeconds, 10)),
			Labels:   make(map[string]model.TemplateString),

			For:                         rule.For.String(),
			KeepFiringFor:               rule.KeepFiringFor.String(),
			NoDataState:                 string(rule.NoDataState),
			ExecErrState:                string(rule.ExecErrState),
			MissingSeriesEvalsToResolve: rule.MissingSeriesEvalsToResolve,
			Annotations:                 make(map[string]model.TemplateString),
		},
	}

	for k, v := range rule.Annotations {
		k8sRule.Spec.Annotations[k] = model.TemplateString(v)
	}
	if rule.DashboardUID != nil {
		k8sRule.Spec.Annotations["grafana_dashboard_uid"] = model.TemplateString(*rule.DashboardUID)
	}
	if rule.PanelID != nil {
		k8sRule.Spec.Annotations["grafana_panel_id"] = model.TemplateString(strconv.FormatInt(*rule.PanelID, 10))
	}

	for k, v := range rule.Labels {
		k8sRule.Spec.Labels[k] = model.TemplateString(v)
	}

	for _, query := range rule.Data {
		modelJson := model.Json{}
		if err := json.Unmarshal(query.Model, &modelJson); err != nil {
			return nil, fmt.Errorf("failed to unmarshal raw message: %w", err)
		}

		k8sRule.Spec.Data[query.RefID] = model.Query{
			QueryType: query.QueryType,
			RelativeTimeRange: model.RelativeTimeRange{
				From: model.PromDurationWMillis(query.RelativeTimeRange.From.String()),
				To:   model.PromDurationWMillis(query.RelativeTimeRange.To.String()),
			},
			Model:  modelJson,
			Source: util.Pointer(rule.Condition == query.RefID),
		}
	}

	for _, setting := range rule.NotificationSettings {
		nfSetting := model.NotificationSettings{
			Receiver: setting.Receiver,
			GroupBy:  setting.GroupBy,
		}
		if setting.GroupWait != nil {
			nfSetting.GroupWait = util.Pointer(setting.GroupWait.String())
		}
		if setting.GroupInterval != nil {
			nfSetting.GroupInterval = util.Pointer(setting.GroupInterval.String())
		}
		if setting.RepeatInterval != nil {
			nfSetting.RepeatInterval = util.Pointer(setting.RepeatInterval.String())
		}
		if setting.MuteTimeIntervals != nil {
			nfSetting.MuteTimeIntervals = make([]model.MuteTimeIntervalRef, 0, len(setting.MuteTimeIntervals))
			for _ = range setting.MuteTimeIntervals {
				// TODO(@rwwiv): Maybe this should be the raw string value so we aren't making multiple DB calls?
			}
		}
		if setting.ActiveTimeIntervals != nil {
			nfSetting.ActiveTimeIntervals = make([]model.ActiveTimeIntervalRef, 0, len(setting.ActiveTimeIntervals))
			for _ = range setting.ActiveTimeIntervals {
				// TODO(@rwwiv): Maybe this should be the raw string value so we aren't making multiple DB calls?
			}
		}
		k8sRule.Spec.NotificationSettings = append(k8sRule.Spec.NotificationSettings, nfSetting)
	}

	return k8sRule, nil
}

func ConvertToK8sResources(
	orgID int64,
	rules []*ngmodels.AlertRule,
	namespaceMapper request.NamespaceMapper,
) (*model.AlertRuleList, error) {
	k8sRules := &model.AlertRuleList{
		Items: make([]model.AlertRule, 0, len(rules)),
	}
	for _, rule := range rules {
		k8sRule, err := ConvertToK8sResource(orgID, rule, namespaceMapper)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to k8s resource: %w", err)
		}
		k8sRules.Items = append(k8sRules.Items, *k8sRule)
	}
	return k8sRules, nil
}

func ConvertToDomainModel(k8sRule *model.AlertRule) (*ngmodels.AlertRule, error) {
	domainRule := &ngmodels.AlertRule{
		UID:          string(k8sRule.UID),
		Title:        k8sRule.Spec.Title,
		NamespaceUID: k8sRule.Namespace,
		Data:         make([]ngmodels.AlertQuery, 0, len(k8sRule.Spec.Data)),
		IsPaused:     k8sRule.Spec.Paused != nil && *k8sRule.Spec.Paused,
		Labels:       make(map[string]string),

		Annotations:          make(map[string]string),
		NotificationSettings: make([]ngmodels.NotificationSettings, 0, len(k8sRule.Spec.NotificationSettings)),
		NoDataState:          ngmodels.NoDataState(k8sRule.Spec.NoDataState),
		ExecErrState:         ngmodels.ExecutionErrorState(k8sRule.Spec.ExecErrState),
	}

	for k, v := range k8sRule.Spec.Annotations {
		if k == "grafana_dashboard_uid" || k == "grafana_panel_id" {
			continue // TODO(@rwwiv): Maybe we should include these as fields on the spec? Not a fan of this.
		}
		domainRule.Annotations[k] = string(v)
	}

	for k, v := range k8sRule.Spec.Labels {
		domainRule.Labels[k] = string(v)
	}

	if k8sRule.Spec.MissingSeriesEvalsToResolve != nil {
		src := *k8sRule.Spec.MissingSeriesEvalsToResolve
		domainRule.MissingSeriesEvalsToResolve = &src
	}

	pendingPeriod, err := prom_model.ParseDuration(k8sRule.Spec.For)
	if err != nil {
		return nil, fmt.Errorf("failed to parse duration: %w", err)
	}
	domainRule.For = time.Duration(pendingPeriod)

	keepFiringFor, err := prom_model.ParseDuration(string(k8sRule.Spec.KeepFiringFor))
	if err != nil {
		return nil, fmt.Errorf("failed to parse duration: %w", err)
	}
	domainRule.KeepFiringFor = time.Duration(keepFiringFor)

	interval, err := strconv.Atoi(string(k8sRule.Spec.Interval))
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval: %w", err)
	}
	domainRule.IntervalSeconds = int64(interval)

	// TODO: Should we include these as fields on the spec? This feels like it could be confusing.
	dashboardUID := k8sRule.Annotations["grafana_dashboard_uid"]
	if dashboardUID != "" {
		domainRule.DashboardUID = &dashboardUID
	}
	panelID, err := strconv.ParseInt(k8sRule.Annotations["grafana_panel_id"], 10, 64)
	if err == nil {
		domainRule.PanelID = &panelID
	}

	for refID, query := range k8sRule.Spec.Data {
		from, err := prom_model.ParseDuration(string(query.RelativeTimeRange.From))
		if err != nil {
			return nil, fmt.Errorf("failed to parse duration: %w", err)
		}
		to, err := prom_model.ParseDuration(string(query.RelativeTimeRange.To))
		if err != nil {
			return nil, fmt.Errorf("failed to parse duration: %w", err)
		}
		modelJson, err := json.Marshal(query.Model)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal model: %w", err)
		}

		domainRule.Data = append(domainRule.Data, ngmodels.AlertQuery{
			RefID:     refID,
			QueryType: query.QueryType,
			RelativeTimeRange: ngmodels.RelativeTimeRange{
				From: ngmodels.Duration(from),
				To:   ngmodels.Duration(to),
			},
			DatasourceUID: string(query.DatasourceUID),
			Model:         modelJson,
		})

		if query.Source != nil && *query.Source {
			domainRule.Condition = refID
		}
	}

	// Technically this is a singleton, but we'll iterate over it to be safe.
	notifSettings := make([]ngmodels.NotificationSettings, 0, len(k8sRule.Spec.NotificationSettings))
	for _, setting := range k8sRule.Spec.NotificationSettings {
		settings := ngmodels.NotificationSettings{
			Receiver: setting.Receiver,
			GroupBy:  setting.GroupBy,
		}
		if setting.GroupWait != nil {
			groupWait, err := prom_model.ParseDuration(*setting.GroupWait)
			if err != nil {
				return nil, fmt.Errorf("failed to parse duration: %w", err)
			}
			settings.GroupWait = &groupWait
		}
		if setting.GroupInterval != nil {
			groupInterval, err := prom_model.ParseDuration(*setting.GroupInterval)
			if err != nil {
				return nil, fmt.Errorf("failed to parse duration: %w", err)
			}
			settings.GroupInterval = &groupInterval
		}
		if setting.RepeatInterval != nil {
			repeatInterval, err := prom_model.ParseDuration(*setting.RepeatInterval)
			if err != nil {
				return nil, fmt.Errorf("failed to parse duration: %w", err)
			}
			settings.RepeatInterval = &repeatInterval
		}
		if setting.MuteTimeIntervals != nil {
			settings.MuteTimeIntervals = make([]string, 0, len(setting.MuteTimeIntervals))
			for _ = range setting.MuteTimeIntervals {
				// TODO(@rwwiv): Maybe this should be the raw string value so we aren't making multiple DB calls?
			}
		}
		if setting.ActiveTimeIntervals != nil {
			settings.ActiveTimeIntervals = make([]string, 0, len(setting.ActiveTimeIntervals))
			for _ = range setting.ActiveTimeIntervals {
				// TODO(@rwwiv): Maybe this should be the raw string value so we aren't making multiple DB calls?
			}
		}
		notifSettings = append(notifSettings, settings)
	}
	domainRule.NotificationSettings = notifSettings

	return domainRule, nil
}
